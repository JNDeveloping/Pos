import { Controller, Get, Injectable, Module, Query } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { CurrentSession, RequirePermissions, Session } from '../../common/auth';
import { PrismaService } from '../../prisma.service';

const eventTypes = new Set(['SCANNED', 'CART_UPDATED', 'ITEM_REMOVED', 'DISCOUNT_APPLIED', 'PAYMENT_STARTED', 'PAYMENT_UPDATED', 'SALE_COMPLETED', 'SALE_CANCELLED']);
type Registration = { branchId: string; terminalId: string; cashSessionId?: string };
type LiveSession = Session & Registration;

@Injectable()
export class PosLiveService {
  private readonly connections = new Map<string, Set<string>>();
  connect(terminalId: string, socketId: string) {
    const sockets = this.connections.get(terminalId) ?? new Set<string>();
    sockets.add(socketId); this.connections.set(terminalId, sockets);
  }
  disconnect(terminalId: string, socketId: string) {
    const sockets = this.connections.get(terminalId); sockets?.delete(socketId);
    if (!sockets?.size) this.connections.delete(terminalId);
  }
  onlineTerminalIds() { return [...this.connections.keys()]; }
}

@WebSocketGateway({ path: '/api/socket.io', cors: { origin: true, credentials: true } })
export class PosLiveGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  constructor(private jwt: JwtService, private db: PrismaService, private live: PosLiveService) {}

  async handleConnection(socket: Socket) {
    try {
      const token = String(socket.handshake.auth?.token ?? '');
      const session = await this.jwt.verifyAsync<Session>(token, { secret: process.env.JWT_SECRET });
      const user = await this.db.user.findFirst({ where: { id: session.sub, companyId: session.companyId, active: true, deletedAt: null, tokenVersion: session.tokenVersion } });
      if (!user) throw new Error('invalid session');
      socket.data.session = session;
      if (session.roles.includes('SUPER_ADMIN') || session.permissions.includes('sales.liveView'))
        await socket.join(session.branchId ? `branch:${session.branchId}` : `company:${session.companyId}`);
    } catch {
      socket.disconnect(true);
    }
  }

  async handleDisconnect(socket: Socket) {
    const session = socket.data.live as LiveSession | undefined;
    if (!session) return;
    this.live.disconnect(session.terminalId, socket.id);
    if (!this.live.onlineTerminalIds().includes(session.terminalId)) {
      const event = await this.persist(session, 'DISCONNECTED', {});
      this.broadcast(session, event);
    }
  }

  @SubscribeMessage('pos:register')
  async register(@ConnectedSocket() socket: Socket, @MessageBody() body: Registration) {
    const auth = socket.data.session as Session | undefined;
    if (!auth || (!auth.roles.includes('SUPER_ADMIN') && !auth.permissions.includes('sales.access')) || !body?.branchId || !body?.terminalId)
      return socket.disconnect(true);
    const terminal = await this.db.terminal.findFirst({ where: { id: body.terminalId, branchId: body.branchId, companyId: auth.companyId, active: true } });
    if (!terminal || (auth.branchId && auth.branchId !== body.branchId)) return socket.disconnect(true);
    const session: LiveSession = { ...auth, branchId: body.branchId, terminalId: body.terminalId, cashSessionId: body.cashSessionId };
    socket.data.live = session; this.live.connect(body.terminalId, socket.id);
    const event = await this.persist(session, 'CONNECTED', {});
    this.broadcast(session, event);
    return { ok: true };
  }

  @SubscribeMessage('pos:activity')
  async activity(@ConnectedSocket() socket: Socket, @MessageBody() body: { type?: string; payload?: unknown }) {
    const session = socket.data.live as LiveSession | undefined;
    if (!session || !body?.type || !eventTypes.has(body.type)) return;
    const payload = sanitizePayload(body.type, body.payload);
    const event = await this.persist(session, body.type, payload);
    this.broadcast(session, event);
  }

  private persist(session: LiveSession, type: string, payload: Prisma.InputJsonValue) {
    return this.db.posLiveEvent.create({ data: { companyId: session.companyId, branchId: session.branchId, terminalId: session.terminalId, cashSessionId: session.cashSessionId, userId: session.sub, type, payload } });
  }
  private broadcast(session: LiveSession, event: unknown) {
    this.server.to(`company:${session.companyId}`).to(`branch:${session.branchId}`).emit('pos:event', event);
  }
}

export function sanitizePayload(type: string, value: unknown): Prisma.InputJsonValue {
  const body = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const base: Record<string, Prisma.InputJsonValue> = {};
  if (typeof body.total === 'number') base.total = body.total;
  if (typeof body.productName === 'string') base.productName = body.productName.slice(0, 120);
  if (typeof body.quantity === 'number') base.quantity = body.quantity;
  if (typeof body.saleNumber === 'string') base.saleNumber = body.saleNumber.slice(0, 80);
  if (type === 'CART_UPDATED' && Array.isArray(body.items))
    base.items = body.items.slice(0, 100).map((item) => {
      const row = item as Record<string, unknown>;
      return { name: String(row.name ?? '').slice(0, 120), quantity: Number(row.quantity ?? 0), subtotal: Number(row.subtotal ?? 0) };
    });
  return base;
}

@Controller('pos-live')
export class PosLiveController {
  constructor(private db: PrismaService, private live: PosLiveService) {}
  @Get() @RequirePermissions('sales.liveView') async state(
    @CurrentSession() session: Session,
    @Query('branchId') branchId?: string,
    @Query('terminalId') terminalId?: string,
  ) {
    const where = { companyId: session.companyId, ...(session.branchId ? { branchId: session.branchId } : branchId ? { branchId } : {}), ...(terminalId ? { terminalId } : {}) };
    const [events, sessions, branches] = await Promise.all([
      this.db.posLiveEvent.findMany({ where, orderBy: { createdAt: 'desc' }, take: 250 }),
      this.db.cashSession.findMany({ where: { companyId: session.companyId, status: 'OPEN', ...(session.branchId ? { branchId: session.branchId } : branchId ? { branchId } : {}), ...(terminalId ? { terminalId } : {}) }, include: { terminal: true, cashier: { select: { firstName: true, lastName: true } } }, orderBy: { openedAt: 'desc' } }),
      this.db.branch.findMany({ where: { companyId: session.companyId, active: true, deletedAt: null, ...(session.branchId ? { id: session.branchId } : {}) }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    ]);
    return { events, sessions, branches, onlineTerminalIds: this.live.onlineTerminalIds() };
  }
}

@Module({ controllers: [PosLiveController], providers: [PosLiveGateway, PosLiveService] })
export class PosLiveModule {}
