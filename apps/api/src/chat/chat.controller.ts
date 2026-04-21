import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Sse,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';
import {
  CreateSessionDto,
  SendMessageDto,
  UpdateSessionDto,
} from './dto/chat.dto';
import { ExecuteToolDto } from './dto/execute-tool.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  RequestUser,
} from '../auth/decorators/current-user.decorator';

@ApiTags('chat')
@ApiBearerAuth('access-token')
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
  ) {}

  // ── LLM Options ────────────────────────────────────────────────────────────

  @Get('llm-options')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary:
      'Get configured LLM providers and their models for the current user',
  })
  @ApiResponse({
    status: 200,
    description: 'List of available providers + models',
  })
  getLLMOptions(@CurrentUser() user: RequestUser) {
    return this.chatService.getLLMOptions(user.userId);
  }

  // ── Sessions ────────────────────────────────────────────────────────────────

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List all chat sessions for the user' })
  @ApiResponse({
    status: 200,
    description: 'List of sessions ordered by most recent',
  })
  getSessions(@CurrentUser() user: RequestUser) {
    return this.chatService.getSessions(user.userId);
  }

  @Post('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a new chat session' })
  @ApiResponse({ status: 201, description: 'Session created' })
  @ApiResponse({
    status: 400,
    description: 'No credentials configured for selected provider',
  })
  createSession(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateSessionDto,
  ) {
    return this.chatService.createSession(user.userId, dto);
  }

  @Get('sessions/:id')
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'id', description: 'Session ID' })
  @ApiOperation({ summary: 'Get session with all messages' })
  @ApiResponse({ status: 200, description: 'Session with messages' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  getSession(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.chatService.getSession(user.userId, id);
  }

  @Delete('sessions/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', description: 'Session ID' })
  @ApiOperation({ summary: 'Delete a chat session and all its messages' })
  @ApiResponse({ status: 204, description: 'Session deleted' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  deleteSession(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.chatService.deleteSession(user.userId, id);
  }

  @Patch('sessions/:id')
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'id', description: 'Session ID' })
  @ApiOperation({ summary: 'Update session provider/model mid-conversation' })
  @ApiResponse({ status: 200, description: 'Session updated' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  updateSession(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateSessionDto,
  ) {
    return this.chatService.updateSession(user.userId, id, dto);
  }

  // ── Messages ────────────────────────────────────────────────────────────────

  @Post('sessions/:id/messages')
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'id', description: 'Session ID' })
  @ApiOperation({
    summary: 'Step 1 — Persist user message, returns userMessageId',
  })
  @ApiResponse({ status: 201, description: '{ userMessageId: string }' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  saveUserMessage(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.saveUserMessage(user.userId, id, dto);
  }

  // ── SSE Streaming ────────────────────────────────────────────────────────────

  @Sse('sessions/:id/stream')
  @ApiParam({ name: 'id', description: 'Session ID' })
  @ApiQuery({
    name: 'content',
    description: 'User message content (URL-encoded)',
  })
  @ApiQuery({
    name: 'capability',
    required: false,
    description: 'help | trade | market | blockchain',
  })
  @ApiQuery({
    name: 'locale',
    required: false,
    description: 'User locale (e.g. es, en, pt)',
  })
  @ApiQuery({
    name: 'agentId',
    required: false,
    description:
      'Agent ID selected by the user (overrides auto-classification)',
  })
  @ApiQuery({
    name: 'token',
    description:
      'JWT access token (required for SSE — EventSource cannot send headers)',
  })
  @ApiOperation({ summary: 'Step 2 — SSE stream of KRYPTO agent response' })
  streamResponse(
    @Param('id') id: string,
    @Query('content') content: string,
    @Query('capability') capability?: string,
    @Query('locale') locale?: string,
    @Query('agentId') agentId?: string,
    @Query('token') token?: string,
  ): Observable<MessageEvent> {
    if (!token) throw new UnauthorizedException('Missing token query param');
    let userId: string;
    try {
      const payload = this.jwtService.verify(token) as { sub: string };
      userId = payload.sub;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    return this.chatService.streamAssistantResponse(
      userId,
      id,
      content,
      capability,
      locale,
      agentId,
    );
  }

  // ── Tool Execution (C.4) ──────────────────────────────────────────────────

  @Post('sessions/:id/tools/execute')
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'id', description: 'Session ID' })
  @ApiOperation({
    summary:
      'Execute a FORGE tool on behalf of the agent (requires confirmation for destructive tools)',
  })
  @ApiResponse({ status: 200, description: 'Tool executed successfully' })
  @ApiResponse({
    status: 400,
    description: 'Missing confirmation or unknown tool',
  })
  @ApiResponse({ status: 404, description: 'Session not found' })
  executeTool(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: ExecuteToolDto,
  ) {
    return this.chatService.executeTool(user.userId, id, dto);
  }

  // ── D: Inline option / quick action selection ─────────────────────────────

  @Post('sessions/:id/select')
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'id', description: 'Session ID' })
  @ApiOperation({
    summary: 'User selects a quick action or inline option from agent response',
  })
  @ApiResponse({ status: 200, description: 'Selection processed' })
  selectOption(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: { optionId: string; value: string },
  ) {
    return this.chatService.processSelection(user.userId, id, body);
  }
}
