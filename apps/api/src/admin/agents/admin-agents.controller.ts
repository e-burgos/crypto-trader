import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { AdminAgentsService } from './admin-agents.service';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import {
  CurrentUser,
  RequestUser,
} from '../../auth/decorators/current-user.decorator';

@ApiTags('admin-agents')
@ApiBearerAuth('access-token')
@Controller('admin/agents')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminAgentsController {
  constructor(private readonly adminAgentsService: AdminAgentsService) {}

  @Get()
  @ApiOperation({ summary: '[ADMIN] Lista de sub-agentes configurables' })
  listAgents() {
    return this.adminAgentsService.listAgents();
  }

  @Get(':id')
  @ApiOperation({ summary: '[ADMIN] Detalle de un agente + documentos' })
  getAgent(@Param('id') id: string) {
    return this.adminAgentsService.getAgent(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: '[ADMIN] Actualizar system prompt o estado del agente',
  })
  updateAgent(@Param('id') id: string, @Body() dto: UpdateAgentDto) {
    return this.adminAgentsService.updateAgent(id, dto);
  }

  @Post(':id/documents')
  @ApiOperation({
    summary: '[ADMIN] Subir documento de conocimiento al agente',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        title: {
          type: 'string',
          description: 'Título descriptivo del documento',
        },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    }),
  )
  uploadDocument(
    @Param('id') agentId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('title') title: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.adminAgentsService.uploadDocument(
      agentId,
      user.userId,
      file,
      title,
    );
  }

  @Delete(':id/documents/:docId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[ADMIN] Eliminar documento de conocimiento' })
  deleteDocument(@Param('id') agentId: string, @Param('docId') docId: string) {
    return this.adminAgentsService.deleteDocument(agentId, docId);
  }

  @Get(':id/documents/:docId/status')
  @ApiOperation({ summary: '[ADMIN] Estado de procesamiento del documento' })
  getDocumentStatus(
    @Param('id') agentId: string,
    @Param('docId') docId: string,
  ) {
    return this.adminAgentsService.getDocumentStatus(agentId, docId);
  }
}
