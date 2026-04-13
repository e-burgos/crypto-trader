import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DocumentProcessorService } from '../../orchestrator/document-processor.service';
import { UpdateAgentDto } from './dto/update-agent.dto';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/x-markdown',
];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

@Injectable()
export class AdminAgentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documentProcessor: DocumentProcessorService,
  ) {}

  // ── CRUD AgentDefinitions ────────────────────────────────────────────────

  async listAgents() {
    return this.prisma.agentDefinition.findMany({
      orderBy: { id: 'asc' },
      include: {
        _count: { select: { documents: true } },
      },
    });
  }

  async getAgent(id: string) {
    const agent = await this.prisma.agentDefinition.findUnique({
      where: { id: id as any },
      include: {
        documents: {
          orderBy: { uploadedAt: 'desc' },
          select: {
            id: true,
            title: true,
            fileName: true,
            mimeType: true,
            sizeBytes: true,
            status: true,
            errorMsg: true,
            uploadedAt: true,
            processedAt: true,
            uploadedBy: true,
            _count: { select: { chunks: true } },
          },
        },
      },
    });
    if (!agent) throw new NotFoundException(`Agent ${id} not found`);
    return agent;
  }

  async updateAgent(id: string, dto: UpdateAgentDto) {
    const agent = await this.prisma.agentDefinition.findUnique({
      where: { id: id as any },
    });
    if (!agent) throw new NotFoundException(`Agent ${id} not found`);

    return this.prisma.agentDefinition.update({
      where: { id: id as any },
      data: {
        ...(dto.systemPrompt !== undefined && {
          systemPrompt: dto.systemPrompt,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  // ── Documents ──────────────────────────────────────────────────────────────

  async uploadDocument(
    agentId: string,
    adminUserId: string,
    file: Express.Multer.File,
    title: string,
  ) {
    // Security: validate MIME type and file size
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type not allowed. Accepted: PDF, TXT, MD`,
      );
    }
    if (file.size > MAX_SIZE_BYTES) {
      throw new BadRequestException(
        `File too large. Maximum size is 10 MB`,
      );
    }

    const agent = await this.prisma.agentDefinition.findUnique({
      where: { id: agentId as any },
    });
    if (!agent) throw new NotFoundException(`Agent ${agentId} not found`);

    const doc = await this.prisma.agentDocument.create({
      data: {
        agentId: agentId as any,
        title: title ?? file.originalname,
        fileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        status: 'PENDING',
        uploadedBy: adminUserId,
      },
    });

    // Enqueue async processing
    await this.documentProcessor.enqueueDocument({
      documentId: doc.id,
      agentId,
      fileName: file.originalname,
      mimeType: file.mimetype,
      fileContent: file.buffer.toString('base64'),
    });

    return {
      id: doc.id,
      status: doc.status,
      message: 'Document queued for processing',
    };
  }

  async deleteDocument(agentId: string, docId: string) {
    const doc = await this.prisma.agentDocument.findFirst({
      where: { id: docId, agentId: agentId as any },
    });
    if (!doc) throw new NotFoundException(`Document ${docId} not found`);

    await this.prisma.agentDocument.delete({ where: { id: docId } });
    return { deleted: true };
  }

  async getDocumentStatus(agentId: string, docId: string) {
    const doc = await this.prisma.agentDocument.findFirst({
      where: { id: docId, agentId: agentId as any },
      select: {
        id: true,
        status: true,
        errorMsg: true,
        processedAt: true,
        _count: { select: { chunks: true } },
      },
    });
    if (!doc) throw new NotFoundException(`Document ${docId} not found`);
    return doc;
  }
}
