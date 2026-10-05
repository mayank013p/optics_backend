import 'dotenv/config';
import bcrypt from 'bcryptjs';
import prisma from './prisma';

async function main() {
  console.log('🌱 Starting Optics database seeding...');

  // 1. Seed Permissions
  const permissionsData = [
    { code: '*', name: 'All Permissions', category: 'system' },
    { code: 'org.manage', name: 'Manage Organization Settings & Security', category: 'Organization' },
    { code: 'user.invite', name: 'Invite Team Members', category: 'Organization' },
    { code: 'user.assign_role', name: 'Manage Member Roles & Access', category: 'Organization' },
    { code: 'user.delete', name: 'Remove Members from Workspace', category: 'Organization' },
    { code: 'workspace.create', name: 'Create Workspaces', category: 'Workspace' },
    { code: 'workspace.manage', name: 'Manage Workspace Settings', category: 'Workspace' },
    { code: 'project.create', name: 'Create Projects', category: 'Project' },
    { code: 'project.update', name: 'Update Project Details', category: 'Project' },
    { code: 'project.delete', name: 'Delete Projects', category: 'Project' },
    { code: 'board.configure', name: 'Configure Kanban Columns & WIP Limits', category: 'Board' },
    { code: 'task.create', name: 'Create & Assign Tasks', category: 'Task' },
    { code: 'task.update', name: 'Edit & Update Tasks', category: 'Task' },
    { code: 'task.move', name: 'Move & Transition Tasks', category: 'Task' },
    { code: 'task.delete', name: 'Delete Tasks', category: 'Task' },
    { code: 'comment.create', name: 'Post Comments & Activity Mentions', category: 'Task' },
    { code: 'doc.create', name: 'Create & Edit Project Wiki Docs', category: 'Document' },
    { code: 'doc.delete', name: 'Delete Project Wiki Docs', category: 'Document' },
    { code: 'attachment.upload', name: 'Upload Cloud Attachments', category: 'Storage' },
    { code: 'attachment.delete', name: 'Delete Cloud Attachments', category: 'Storage' },
  ];

  for (const p of permissionsData) {
    await prisma.permission.upsert({
      where: { code: p.code },
      update: {},
      create: p,
    });
  }

  // 2. Seed Roles
  const ownerRole = await prisma.role.upsert({
    where: { id: 'role-owner' },
    update: {},
    create: {
      id: 'role-owner',
      name: 'Organization Owner',
      description: 'Super-admin with unrestricted capabilities across the organization',
      isSystem: true,
    },
  });

  const devRole = await prisma.role.upsert({
    where: { id: 'role-dev' },
    update: {},
    create: {
      id: 'role-dev',
      name: 'Developer',
      description: 'Can manage issues, participate in boards, and contribute to project docs',
      isSystem: true,
    },
  });

  // 3. Seed Demo Users
  const passwordHash = await bcrypt.hash('Ivors@Optics2026', 10);
  const mayank = await prisma.user.upsert({
    where: { email: 'mayank@ivors.in' },
    update: {
      passwordHash,
    },
    create: {
      email: 'mayank@ivors.in',
      name: 'Mayank Aitan',
      passwordHash,
      jobTitle: 'Founder & Lead Architect',
    },
  });

  const raj = await prisma.user.upsert({
    where: { email: 'raj@ivors.in' },
    update: {
      passwordHash,
    },
    create: {
      email: 'raj@ivors.in',
      name: 'Raj Sharma',
      passwordHash,
      jobTitle: 'Senior Frontend Engineer',
    },
  });

  const aarushi = await prisma.user.upsert({
    where: { email: 'aarushi@ivors.in' },
    update: {
      passwordHash,
    },
    create: {
      email: 'aarushi@ivors.in',
      name: 'Aarushi Patel',
      passwordHash,
      jobTitle: 'Product Designer',
    },
  });

  // 4. Seed Organization
  const org = await prisma.organization.upsert({
    where: { slug: 'ivors-hq' },
    update: {},
    create: {
      name: 'Ivors HQ',
      slug: 'ivors-hq',
      members: {
        create: [
          { userId: mayank.id, roleId: ownerRole.id },
          { userId: raj.id, roleId: devRole.id },
          { userId: aarushi.id, roleId: devRole.id },
        ],
      },
      workspaces: {
        create: {
          name: 'Core Products',
          slug: 'core-products',
          members: {
            create: [
              { userId: mayank.id, roleId: ownerRole.id },
              { userId: raj.id, roleId: devRole.id },
              { userId: aarushi.id, roleId: devRole.id },
            ],
          },
        },
      },
    },
    include: {
      workspaces: true,
    },
  });

  const workspace = org.workspaces[0];

  // 5. Seed Projects: Optics & Connexon
  const opticsProject = await prisma.project.upsert({
    where: { organizationId_key: { organizationId: org.id, key: 'OPT' } },
    update: {},
    create: {
      name: 'Optics Platform',
      key: 'OPT',
      description: 'Next-generation Jira/Plane/Notion alternative work management system.',
      color: '#6366F1',
      icon: 'layers',
      organizationId: org.id,
      workspaceId: workspace.id,
      leadId: mayank.id,
      members: {
        create: [
          { userId: mayank.id, roleId: ownerRole.id },
          { userId: raj.id, roleId: devRole.id },
          { userId: aarushi.id, roleId: devRole.id },
        ],
      },
      boards: {
        create: {
          name: 'Sprint & Release Board',
          isDefault: true,
          columns: {
            create: [
              { name: 'Backlog', position: 0, color: '#64748B' },
              { name: 'Todo', position: 1, color: '#3B82F6' },
              { name: 'In Progress', position: 2, color: '#F59E0B' },
              { name: 'Review', position: 3, color: '#8B5CF6' },
              { name: 'Done', position: 4, color: '#10B981' },
            ],
          },
        },
      },
      labels: {
        create: [
          { name: 'Architecture', color: '#6366F1' },
          { name: 'Frontend', color: '#EC4899' },
          { name: 'Backend', color: '#10B981' },
          { name: 'Realtime', color: '#F59E0B' },
        ],
      },
    },
    include: {
      boards: {
        include: { columns: { orderBy: { position: 'asc' } } },
      },
    },
  });

  const board = opticsProject.boards[0];
  const colBacklog = board.columns[0];
  const colTodo = board.columns[1];
  const colInProgress = board.columns[2];
  const colReview = board.columns[3];
  const colDone = board.columns[4];

  // 6. Seed Issues
  const issuesData = [
    {
      key: 'OPT-1',
      title: 'Design Multi-level Granular RBAC Matrix',
      description: 'Define exact permissions for Org Owner, Org Admin, Workspace Admin, PM, Dev, and Viewer roles.',
      priority: 'HIGH' as const,
      type: 'FEATURE' as const,
      estimate: 5,
      columnId: colDone.id,
      assigneeId: mayank.id,
    },
    {
      key: 'OPT-2',
      title: 'Implement WebSocket Real-time Board Synchronization',
      description: 'Enable instant drag-and-drop state reflection across all connected team members without page refresh.',
      priority: 'URGENT' as const,
      type: 'FEATURE' as const,
      estimate: 8,
      columnId: colInProgress.id,
      assigneeId: raj.id,
    },
    {
      key: 'OPT-3',
      title: 'Notion-style Collaborative Wiki Editor',
      description: 'Support markdown documents, block-based formatting, and direct linking to tasks and code PRs.',
      priority: 'MEDIUM' as const,
      type: 'FEATURE' as const,
      estimate: 8,
      columnId: colTodo.id,
      assigneeId: aarushi.id,
    },
    {
      key: 'OPT-4',
      title: 'PostgreSQL Relational Schema with Multi-tenancy',
      description: 'Setup database tables with foreign key cascades, tenant isolation, and audit log streams.',
      priority: 'HIGH' as const,
      type: 'TASK' as const,
      estimate: 3,
      columnId: colDone.id,
      assigneeId: mayank.id,
    },
    {
      key: 'OPT-5',
      title: 'Pluggable S3 / Cloudflare R2 File Storage Driver',
      description: 'Abstract file uploads so attachments are offloaded from PostgreSQL to object storage.',
      priority: 'MEDIUM' as const,
      type: 'IMPROVEMENT' as const,
      estimate: 5,
      columnId: colBacklog.id,
      assigneeId: raj.id,
    },
  ];

  for (const item of issuesData) {
    const existing = await prisma.issue.findFirst({
      where: { projectId: opticsProject.id, key: item.key },
    });

    if (!existing) {
      await prisma.issue.create({
        data: {
          key: item.key,
          title: item.title,
          description: item.description,
          priority: item.priority,
          type: item.type,
          estimate: item.estimate,
          projectId: opticsProject.id,
          boardId: board.id,
          columnId: item.columnId,
          reporterId: mayank.id,
          assignees: {
            create: { userId: item.assigneeId },
          },
        },
      });
    }
  }

  // 7. Seed Project Documents
  const existingDoc = await prisma.document.findFirst({
    where: { projectId: opticsProject.id, title: 'Optics System Architecture & Guidelines' },
  });

  if (!existingDoc) {
    await prisma.document.create({
      data: {
        title: 'Optics System Architecture & Guidelines',
        content: `# Optics System Architecture\n\n**Parent Brand:** Ivors\n**Domain:** optics.ivors.in\n\n## Core Pillars\n1. **Board-driven Project Management** with realtime socket events\n2. **Notion-like Project Wikis** with task references\n3. **PostgreSQL Relational Core** for clean multi-tenant data\n4. **Pluggable Object Storage** (S3/R2)\n5. **Multi-level Dynamic RBAC**`,
        projectId: opticsProject.id,
        authorId: mayank.id,
        isPublished: true,
      },
    });
  }

  console.log('✅ Optics database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
