import prisma from '../config/database';
import { ApiError } from '../utils/apiError';

export class DocService {
  async listDocuments(projectId?: string) {
    const where: any = {};
    if (projectId) where.projectId = String(projectId);

    const docs = await prisma.document.findMany({
      where,
      include: {
        author: { select: { id: true, name: true, avatarUrl: true, email: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return docs;
  }

  async getProjectDocs(projectId: string) {
    return this.listDocuments(projectId);
  }

  async createDoc(params: { projectId?: string; title: string; content?: string; icon?: string; authorId: string }) {
    const { projectId, title, content, icon, authorId } = params;

    let targetProjectId = projectId;
    if (!targetProjectId) {
      const firstProject = await prisma.project.findFirst();
      if (firstProject) {
        targetProjectId = firstProject.id;
      } else {
        throw ApiError.badRequest('Project ID is required. Please create a project first.');
      }
    }

    const doc = await prisma.document.create({
      data: {
        title,
        content: content || '# ' + title + '\n\nStart writing documentation...',
        icon: icon || 'file-text',
        projectId: targetProjectId,
        authorId,
        isPublished: true,
      },
      include: {
        author: { select: { id: true, name: true } },
      },
    });

    return doc;
  }

  async updateDoc(docId: string, params: { title?: string; content?: string; icon?: string }) {
    const { title, content, icon } = params;

    const doc = await prisma.document.update({
      where: { id: docId },
      data: {
        title,
        content,
        icon,
      },
      include: {
        author: { select: { id: true, name: true } },
      },
    });

    return doc;
  }

  async deleteDoc(docId: string) {
    await prisma.document.delete({ where: { id: docId } });
    return { success: true, message: 'Document deleted' };
  }
}

export const docService = new DocService();
