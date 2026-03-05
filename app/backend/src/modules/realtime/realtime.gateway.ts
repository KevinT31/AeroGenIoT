import { Logger } from "@nestjs/common";
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { JwtService } from "@nestjs/jwt";

type SubscribePayload = {
  farmId?: string;
  plotId?: string;
  deviceId?: string;
};

@WebSocketGateway({ namespace: "/realtime", cors: { origin: "*" } })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private logger = new Logger(RealtimeGateway.name);

  constructor(private jwt: JwtService) {}

  handleConnection(client: Socket) {
    const token =
      (client.handshake.auth?.token as string | undefined) ||
      (client.handshake.headers?.authorization as string | undefined)?.replace("Bearer ", "");

    if (token) {
      try {
        client.data.user = this.jwt.verify(token, {
          secret: process.env.JWT_SECRET || "dev-secret",
        });
      } catch {
        if (process.env.WS_AUTH_REQUIRED === "true") {
          client.disconnect(true);
          return;
        }
      }
    } else if (process.env.WS_AUTH_REQUIRED === "true") {
      client.disconnect(true);
      return;
    }

    const farmId = client.handshake.query?.farmId as string | undefined;
    const plotId = client.handshake.query?.plotId as string | undefined;
    const deviceId = client.handshake.query?.deviceId as string | undefined;
    this.joinRooms(client, { farmId, plotId, deviceId });
    this.logger.log(`Connected ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Disconnected ${client.id}`);
  }

  @SubscribeMessage("subscribe")
  handleSubscribe(client: Socket, payload: SubscribePayload) {
    this.joinRooms(client, payload);
    client.emit("subscribed", payload);
  }

  @SubscribeMessage("unsubscribe")
  handleUnsubscribe(client: Socket, payload: SubscribePayload) {
    this.leaveRooms(client, payload);
    client.emit("unsubscribed", payload);
  }

  emitReading(payload: any) {
    this.emitToTargets("reading.new", payload);
  }

  emitRecommendation(payload: any) {
    this.emitToTargets("recommendation.new", payload);
  }

  emitAlert(payload: any) {
    this.emitToTargets("alert.new", payload);
  }

  emitAlertUpdate(payload: any) {
    this.emitToTargets("alert.updated", payload);
  }

  private joinRooms(client: Socket, payload: SubscribePayload) {
    const rooms = this.buildRooms(payload);
    rooms.forEach((room) => client.join(room));
  }

  private leaveRooms(client: Socket, payload: SubscribePayload) {
    const rooms = this.buildRooms(payload);
    rooms.forEach((room) => client.leave(room));
  }

  private emitToTargets(event: string, payload: any) {
    if (!this.server) return;
    const rooms = this.buildRooms(payload);
    if (!rooms.length) {
      this.server.emit(event, payload);
      return;
    }
    this.server.to(rooms).emit(event, payload);
  }

  private buildRooms(payload: SubscribePayload) {
    const rooms: string[] = [];
    if (payload?.farmId) rooms.push(`farm:${payload.farmId}`);
    if (payload?.plotId) rooms.push(`plot:${payload.plotId}`);
    if (payload?.deviceId) rooms.push(`device:${payload.deviceId}`);
    return rooms;
  }
}
