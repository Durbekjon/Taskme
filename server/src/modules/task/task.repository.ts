import { CreateTaskDto } from './dto/create-task.dto'
import { Prisma, Task } from '@prisma/client'
import { Injectable, OnModuleInit } from '@nestjs/common'
import { TaskReorderDto } from './dto/reorder-tasks.dto'
import { TaskQueryDto } from './dto/query.task.dto'
import { MoveTaskDto } from './dto/move-task.dto'
import { IPagination } from '@core/types/pagination'
import { PrismaService } from '@core/prisma/prisma.service'
import { TaskWithRelations } from './types/task.types'

@Injectable()
export class TaskRepository implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}
  async onModuleInit() {
    await this.prisma.log.deleteMany()
  }
  findOne(id: string): Promise<TaskWithRelations | null> {
    return this.prisma.task.findUnique({
      where: { id },
      include: { members: true, chat: true },
    })
  }

  async getTasksBySheet(
    options: { sheetId: string; memberId: string | null },
    reqQuery: TaskQueryDto,
  ): Promise<{ tasks: Task[]; pagination: IPagination }> {
    const { sheetId, memberId } = options
    const { page = 1, limit = 12, search, filters } = reqQuery

    console.log('getTasksBySheet called with:', {
      sheetId,
      memberId,
      page,
      limit,
      search,
      filters,
    })

    const parsedPage = Number(page)
    const parsedLimit = Number(limit)

    // ✅ Start with base filters
    let whereConditions: Prisma.TaskWhereInput = {
      sheetId,
      ...(memberId && {
        members: {
          some: { id: memberId },
        },
      }),
    }

    if (filters) {
      try {
        const validatedFilters = this.validateFilters(filters)
        console.log('Validated filters:', validatedFilters)
        whereConditions = {
          ...(whereConditions as Prisma.TaskWhereInput),
          ...validatedFilters,
        }
      } catch (error) {
        console.error('Error processing filters:', error)
        // Continue without filters if validation fails
      }
    }

    if (search) {
      whereConditions = {
        ...whereConditions,
        name: {
          contains: search,
          mode: 'insensitive',
        },
      }
    }

    try {
      const [tasks, count] = await Promise.all([
        this.prisma.task.findMany({
          where: whereConditions,
          include: {
            members: {
              include: {
                user: {
                  include: {
                    avatar: {
                      select: {
                        id: true,
                        path: true,
                      },
                    },
                  },
                },
              },
            },
            files: {
              select: {
                id: true,
                path: true,
              },
            },
            lastUpdatedByUser: {
              select: {
                id: true,
                avatar: {
                  select: {
                    id: true,
                    path: true,
                  },
                },
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            chat: true,
          },
          skip: (parsedPage - 1) * parsedLimit,
          take: parsedLimit,
          orderBy: { order: 'desc' },
        }),
        this.prisma.task.count({
          where: whereConditions,
        }),
      ])

      return {
        tasks,
        pagination: {
          page: parsedPage,
          pages: Math.ceil(count / parsedLimit),
          limit: parsedLimit,
          count,
        },
      }
    } catch (error) {
      console.error('Database error in getTasksBySheet:', {
        sheetId,
        memberId,
        filters,
        search,
        page: parsedPage,
        limit: parsedLimit,
        error: error.message,
        stack: error.stack,
      })
      throw new Error(
        `Failed to fetch tasks for sheet ID ${sheetId}: ${error.message}`,
      )
    }
  }

  async createTask(
    body: CreateTaskDto,
    companyId: string,
    userId: string,
  ): Promise<Task> {
    const {
      links = [],
      sheetId,
      name,
      members,
      status,
      priority,
      price,
      paid,
      duedate1,
      duedate2,
      duedate3,
      duedate4,
      duedate5,
    } = body

    // Find the sheet and retrieve workspaceId, validate existence
    const sheet = await this.prisma.sheet.findUnique({
      where: { id: sheetId },
      select: { workspaceId: true },
    })

    if (!sheet) {
      throw new Error(`Sheet with ID ${sheetId} not found.`)
    }

    // Process due date arrays
    const processedDueDates = {
      duedate1: duedate1?.map((date) => this.toIsoStringIfExists(date)),
      duedate2: duedate2?.map((date) => this.toIsoStringIfExists(date)),
      duedate3: duedate3?.map((date) => this.toIsoStringIfExists(date)),
      duedate4: duedate4?.map((date) => this.toIsoStringIfExists(date)),
      duedate5: duedate5?.map((date) => this.toIsoStringIfExists(date)),
    }

    // Construct task creation data
    const taskData: Prisma.TaskCreateInput = {
      name,
      workspace: { connect: { id: sheet.workspaceId } },
      sheet: { connect: { id: sheetId } },
      company: { connect: { id: companyId } },
      chat: {
        create: {
          name,
          members: members
            ? { connect: members.map((id) => ({ id })) }
            : undefined,
          permissions: { create: {} },
        },
      },
      lastUpdatedByUser: { connect: { id: userId } },
      members: members ? { connect: members.map((id) => ({ id })) } : undefined,
      status,
      priority,
      links,
      price,
      paid,
      ...processedDueDates,
    }

    try {
      return await this.prisma.task.create({ data: taskData })
    } catch (error) {
      throw new Error(`Failed to create task: ${error.message}`)
    }
  }

  async updateTask(
    taskId: string,
    updateData: Prisma.TaskUpdateInput,
  ): Promise<Task> {
    try {
      // Transform all date fields to ISO-8601 if present
      const dateFields = ['date1', 'date2', 'date3', 'date4', 'date5']
      for (const field of dateFields) {
        if (updateData[field]) {
          updateData[field] = this.toIsoStringIfExists(updateData[field])
        }
      }

      // Transform due date array fields to ISO-8601 if present
      const dueDateFields = [
        'duedate1',
        'duedate2',
        'duedate3',
        'duedate4',
        'duedate5',
      ]
      for (const field of dueDateFields) {
        if (updateData[field] && Array.isArray(updateData[field])) {
          updateData[field] = (updateData[field] as string[]).map((date) =>
            this.toIsoStringIfExists(date),
          )
        }
      }

      return await this.prisma.task.update({
        where: { id: taskId },
        data: updateData,
        include: {
          members: true,
          chat: true,
          lastUpdatedByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatar: true,
            },
          },
          files: {
            select: {
              id: true,
              path: true,
            },
          },
        },
      })
    } catch (error) {
      throw new Error(`Failed to update task: ${error.message}`)
    }
  }

  async reorder(body: TaskReorderDto) {
    body.orders = body.orders.reverse()
    await this.prisma
      .$transaction(
        body.taskId.map((id, index) =>
          this.prisma.task.update({
            where: { id },
            data: { order: body.orders[index] },
          }),
        ),
      )
      .catch((error) => {
        throw new Error(`Failed to reorder tasks: ${error.message}`)
      })
    const task = await this.prisma.task.findUnique({
      where: { id: body.taskId[0] },
    })

    return task
  }

  async move(body: MoveTaskDto, workspaceId: string) {
    return await this.prisma.task.update({
      where: { id: body.taskId },
      data: {
        sheet: {
          connect: {
            id: body.sheetId,
          },
        },
        workspace: {
          connect: {
            id: workspaceId,
          },
        },
      },
    })
  }

  async deleteTask(taskId: string): Promise<Task> {
    try {
      return await this.prisma.task.delete({ where: { id: taskId } })
    } catch (error) {
      throw new Error(`Failed to delete task: ${error.message}`)
    }
  }

  async findById(id: string): Promise<TaskWithRelations | null> {
    return this.prisma.task.findUnique({
      where: { id },
      include: { members: true, chat: true },
    })
  }

  async findBySheet(sheetId: string): Promise<Task[]> {
    return this.prisma.task.findMany({ where: { sheetId } })
  }

  async updateMany(args: Prisma.TaskUpdateManyArgs) {
    return this.prisma.task.updateMany(args)
  }

  async bulkDelete(taskIds: string[], companyId: string) {
    const existTasks = await this.prisma.task.findMany({
      where: { id: { in: taskIds }, companyId },
    })

    taskIds = existTasks.map((task) => task.id)

    return this.prisma.task.deleteMany({
      where: { id: { in: taskIds } },
    })
  }

  private toIsoStringIfExists(date) {
    return date ? new Date(date).toISOString() : undefined
  }
  private validateFilters(filters: string) {
    try {
      const parsedFilters = JSON.parse(filters)

      // Normalize filter keys to lowercase for consistency
      const normalizedFilters = {}
      Object.keys(parsedFilters).forEach((key) => {
        const normalizedKey = key.toLowerCase()
        normalizedFilters[normalizedKey] = parsedFilters[key]
      })

      Object.keys(normalizedFilters).forEach((key) => {
        const value = normalizedFilters[key]

        // Skip null, undefined, or empty values
        if (value === null || value === undefined || value === '') {
          delete normalizedFilters[key]
          return
        }

        if (key === 'name') {
          normalizedFilters[key] = {
            contains: value,
            mode: 'insensitive',
          }
        } else if (key === 'status' || key === 'priority') {
          if (Array.isArray(value)) {
            // Filter out empty/null values from arrays
            const validValues = value.filter(
              (v) => v !== null && v !== undefined && v !== '',
            )
            if (validValues.length > 0) {
              normalizedFilters[key] = { in: validValues }
            } else {
              delete normalizedFilters[key]
            }
          } else {
            normalizedFilters[key] = { equals: value }
          }
        } else if (key === 'links') {
          if (Array.isArray(value)) {
            const validLinks = value.filter(
              (v) => v !== null && v !== undefined && v !== '',
            )
            if (validLinks.length > 0) {
              normalizedFilters[key] = { in: validLinks }
            } else {
              delete normalizedFilters[key]
            }
          } else {
            normalizedFilters[key] = { equals: value }
          }
        } else if (key === 'price') {
          const numValue = Number(value)
          if (!isNaN(numValue)) {
            normalizedFilters[key] = { equals: numValue }
          } else {
            delete normalizedFilters[key]
          }
        } else if (key === 'paid') {
          normalizedFilters[key] = { equals: Boolean(value) }
        } else if (key === 'members') {
          if (Array.isArray(value)) {
            const validMembers = value.filter(
              (v) => v !== null && v !== undefined && v !== '',
            )
            if (validMembers.length > 0) {
              normalizedFilters[key] = { in: validMembers }
            } else {
              delete normalizedFilters[key]
            }
          } else {
            normalizedFilters[key] = { equals: value }
          }
        } else if (key.startsWith('text')) {
          normalizedFilters[key] = {
            contains: value,
            mode: 'insensitive',
          }
        } else if (key.startsWith('number')) {
          const numValue = Number(value)
          if (!isNaN(numValue)) {
            normalizedFilters[key] = { equals: numValue }
          } else {
            delete normalizedFilters[key]
          }
        } else if (key.startsWith('checkbox')) {
          normalizedFilters[key] = { equals: Boolean(value) }
        } else if (key.startsWith('select')) {
          if (Array.isArray(value)) {
            const validValues = value.filter(
              (v) => v !== null && v !== undefined && v !== '',
            )
            if (validValues.length > 0) {
              normalizedFilters[key] = { in: validValues }
            } else {
              delete normalizedFilters[key]
            }
          } else {
            normalizedFilters[key] = { equals: value }
          }
        } else if (key.startsWith('date')) {
          try {
            const dateValue = new Date(value)
            if (!isNaN(dateValue.getTime())) {
              normalizedFilters[key] = { equals: dateValue }
            } else {
              delete normalizedFilters[key]
            }
          } catch {
            delete normalizedFilters[key]
          }
        } else if (key.startsWith('duedate')) {
          if (Array.isArray(value)) {
            try {
              const validDates = value
                .filter((v) => v !== null && v !== undefined && v !== '')
                .map((date) => new Date(date))
                .filter((date) => !isNaN(date.getTime()))

              if (validDates.length > 0) {
                normalizedFilters[key] = { in: validDates }
              } else {
                delete normalizedFilters[key]
              }
            } catch {
              delete normalizedFilters[key]
            }
          } else {
            try {
              const dateValue = new Date(value)
              if (!isNaN(dateValue.getTime())) {
                normalizedFilters[key] = { equals: dateValue }
              } else {
                delete normalizedFilters[key]
              }
            } catch {
              delete normalizedFilters[key]
            }
          }
        }
      })

      return normalizedFilters
    } catch (error) {
      console.error('Error parsing filters:', error)
      // Return empty object if parsing fails to avoid breaking the query
      return {}
    }
  }
}
