/**
 * Integration tests for task filtering with malformed JSON
 * Tests the complete flow from controller to database
 */

import { Test, TestingModule } from '@nestjs/testing'
import { TaskService } from '../task.service'
import { TaskRepository } from '../task.repository'
import { UserService } from '@user/user.service'
import { RoleService } from '@role/role.service'
import { SheetService } from '@sheet/sheet.service'
import { PrismaService } from '@core/prisma/prisma.service'
import { MemberService } from '@member/member.service'
import { SubscriptionValidationService } from '@core/subscription-validation/subscription-validation.service'
import { FileStorageService } from '@core/file-storage/file-storage.service'
import { FileRepository } from '../../file/file.repository'
import { TaskQueryDto } from '../dto/query.task.dto'

describe('TaskService - Integration Tests', () => {
  let service: TaskService
  let repository: TaskRepository
  let prismaService: PrismaService

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com'
  }

  const mockRole = {
    type: 'AUTHOR',
    companyId: 'company-123',
    access: { id: 'access-123' }
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskService,
        {
          provide: TaskRepository,
          useValue: {
            getTasksBySheet: jest.fn(),
            findById: jest.fn(),
            createTask: jest.fn(),
            updateTask: jest.fn(),
            deleteTask: jest.fn(),
            reorder: jest.fn(),
            move: jest.fn(),
            bulkDelete: jest.fn(),
          },
        },
        {
          provide: UserService,
          useValue: {
            getUser: jest.fn(),
          },
        },
        {
          provide: RoleService,
          useValue: {
            getUserSelectedRole: jest.fn(),
          },
        },
        {
          provide: SheetService,
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            task: {
              findMany: jest.fn(),
              count: jest.fn(),
            },
            log: {
              create: jest.fn(),
            },
          },
        },
        {
          provide: MemberService,
          useValue: {
            findOneMember: jest.fn(),
          },
        },
        {
          provide: SubscriptionValidationService,
          useValue: {
            validateSubscriptionToTask: jest.fn(),
          },
        },
        {
          provide: FileStorageService,
          useValue: {
            saveFile: jest.fn(),
            deleteFile: jest.fn(),
          },
        },
        {
          provide: FileRepository,
          useValue: {
            createFile: jest.fn(),
            getFilesByTask: jest.fn(),
            getFilesByIds: jest.fn(),
            deleteFiles: jest.fn(),
          },
        },
      ],
    }).compile()

    service = module.get<TaskService>(TaskService)
    repository = module.get<TaskRepository>(TaskRepository)
    prismaService = module.get<PrismaService>(PrismaService)
  })

  describe('getTasksBySheet - Malformed Filter Integration', () => {
    it('should handle the specific reported malformed filter', async () => {
      jest.spyOn(service as any, 'validateUserAccess').mockResolvedValue(mockRole)
      jest.spyOn(service as any, 'getMemberIdForTaskRetrieval').mockReturnValue(null)

      const mockTasks = [
        { id: 'task-1', name: 'Task 1', status: 'In progress' },
        { id: 'task-2', name: 'Task 2', status: 'Done' }
      ]

      jest.spyOn(repository, 'getTasksBySheet').mockResolvedValue({
        tasks: mockTasks,
        pagination: {
          page: 1,
          pages: 1,
          limit: 10,
          count: 2
        }
      })

      const query: TaskQueryDto = {
        page: 1,
        limit: 10,
        filters: '["members":[*d51f55cd-7a4f-4f88-bb9c-b8fd 1"]," status" [\'"In progress"])'
      }

      const result = await service.getTasksBySheet(mockUser, 'sheet-123', query)

      expect(result).toEqual({
        tasks: mockTasks,
        pagination: {
          page: 1,
          pages: 1,
          limit: 10,
          count: 2
        }
      })

      expect(repository.getTasksBySheet).toHaveBeenCalledWith(
        { sheetId: 'sheet-123', memberId: null },
        query
      )
    })

    it('should handle various malformed filter patterns', async () => {
      jest.spyOn(service as any, 'validateUserAccess').mockResolvedValue(mockRole)
      jest.spyOn(service as any, 'getMemberIdForTaskRetrieval').mockReturnValue(null)

      const mockTasks = [{ id: 'task-1', name: 'Task 1' }]

      jest.spyOn(repository, 'getTasksBySheet').mockResolvedValue({
        tasks: mockTasks,
        pagination: { page: 1, pages: 1, limit: 10, count: 1 }
      })

      const malformedFilters = [
        '["members":[*uuid1,*uuid2],"status":["In progress"]]',
        '{"members":[*uuid1],"status":[\'"In progress"]}',
        'members:[*uuid1],status:["In progress"]',
        '{"status":[\'"In progress",\'"Done"]}',
        '{" priority":["High"]," status":["In progress"]}',
        '{"members":[*uuid-with-spaces 123"]}',
        '{"status" ["In progress"],"priority" ["High"]}'
      ]

      for (const filters of malformedFilters) {
        const query: TaskQueryDto = {
          page: 1,
          limit: 10,
          filters
        }

        const result = await service.getTasksBySheet(mockUser, 'sheet-123', query)
        expect(result).toBeDefined()
        expect(result.tasks).toEqual(mockTasks)
      }
    })

    it('should handle completely invalid filters gracefully', async () => {
      jest.spyOn(service as any, 'validateUserAccess').mockResolvedValue(mockRole)
      jest.spyOn(service as any, 'getMemberIdForTaskRetrieval').mockReturnValue(null)

      const mockTasks = [{ id: 'task-1', name: 'Task 1' }]

      jest.spyOn(repository, 'getTasksBySheet').mockResolvedValue({
        tasks: mockTasks,
        pagination: { page: 1, pages: 1, limit: 10, count: 1 }
      })

      const invalidFilters = [
        'not json at all',
        '{invalid json}',
        '{"incomplete":',
        '{"trailing": "comma",}',
        '{"unclosed": "string',
        '{"unclosed": [',
        '{"unclosed": {"nested":',
        null,
        undefined,
        '',
        '   '
      ]

      for (const filters of invalidFilters) {
        const query: TaskQueryDto = {
          page: 1,
          limit: 10,
          filters: filters as any
        }

        const result = await service.getTasksBySheet(mockUser, 'sheet-123', query)
        expect(result).toBeDefined()
        expect(result.tasks).toEqual(mockTasks)
      }
    })

    it('should handle large malformed filter strings', async () => {
      jest.spyOn(service as any, 'validateUserAccess').mockResolvedValue(mockRole)
      jest.spyOn(service as any, 'getMemberIdForTaskRetrieval').mockReturnValue(null)

      const mockTasks = [{ id: 'task-1', name: 'Task 1' }]

      jest.spyOn(repository, 'getTasksBySheet').mockResolvedValue({
        tasks: mockTasks,
        pagination: { page: 1, pages: 1, limit: 10, count: 1 }
      })

      // Create a large malformed filter
      const largeUuids = Array.from({ length: 100 }, (_, i) => `*uuid${i}`).join(',')
      const largeStatuses = Array.from({ length: 50 }, (_, i) => `'"Status${i}"`).join(',')
      const largeFilter = `["members":[${largeUuids}]," status" [${largeStatuses}]]`

      const query: TaskQueryDto = {
        page: 1,
        limit: 10,
        filters: largeFilter
      }

      const startTime = Date.now()
      const result = await service.getTasksBySheet(mockUser, 'sheet-123', query)
      const endTime = Date.now()

      expect(result).toBeDefined()
      expect(result.tasks).toEqual(mockTasks)
      expect(endTime - startTime).toBeLessThan(1000) // Should complete in under 1 second
    })
  })

  describe('getTasksBySheet - Error Handling Integration', () => {
    it('should handle database errors during filter processing', async () => {
      jest.spyOn(service as any, 'validateUserAccess').mockResolvedValue(mockRole)
      jest.spyOn(service as any, 'getMemberIdForTaskRetrieval').mockReturnValue(null)

      jest.spyOn(repository, 'getTasksBySheet').mockRejectedValue(new Error('Database connection failed'))

      const query: TaskQueryDto = {
        page: 1,
        limit: 10,
        filters: '["members":[*uuid1]," status" [\'"In progress"])'
      }

      await expect(service.getTasksBySheet(mockUser, 'sheet-123', query))
        .rejects.toThrow('Database connection failed')
    })

    it('should handle role validation errors', async () => {
      jest.spyOn(service as any, 'validateUserAccess').mockRejectedValue(new Error('Access denied'))

      const query: TaskQueryDto = {
        page: 1,
        limit: 10,
        filters: '["members":[*uuid1]]'
      }

      await expect(service.getTasksBySheet(mockUser, 'sheet-123', query))
        .rejects.toThrow('Access denied')
    })

    it('should handle concurrent requests with malformed filters', async () => {
      jest.spyOn(service as any, 'validateUserAccess').mockResolvedValue(mockRole)
      jest.spyOn(service as any, 'getMemberIdForTaskRetrieval').mockReturnValue(null)

      const mockTasks = [{ id: 'task-1', name: 'Task 1' }]

      jest.spyOn(repository, 'getTasksBySheet').mockResolvedValue({
        tasks: mockTasks,
        pagination: { page: 1, pages: 1, limit: 10, count: 1 }
      })

      const malformedFilters = [
        '["members":[*uuid1]," status" [\'"In progress"])',
        '["members":[*uuid2]," status" [\'"Done"])',
        '["members":[*uuid3]," status" [\'"Pending"])'
      ]

      const queries = malformedFilters.map(filters => ({
        page: 1,
        limit: 10,
        filters
      }))

      const promises = queries.map(query => 
        service.getTasksBySheet(mockUser, 'sheet-123', query)
      )

      const results = await Promise.all(promises)

      results.forEach(result => {
        expect(result).toBeDefined()
        expect(result.tasks).toEqual(mockTasks)
      })
    })
  })

  describe('getTasksBySheet - Performance Integration', () => {
    it('should handle high-frequency requests with malformed filters', async () => {
      jest.spyOn(service as any, 'validateUserAccess').mockResolvedValue(mockRole)
      jest.spyOn(service as any, 'getMemberIdForTaskRetrieval').mockReturnValue(null)

      const mockTasks = [{ id: 'task-1', name: 'Task 1' }]

      jest.spyOn(repository, 'getTasksBySheet').mockResolvedValue({
        tasks: mockTasks,
        pagination: { page: 1, pages: 1, limit: 10, count: 1 }
      })

      const malformedFilter = '["members":[*uuid1]," status" [\'"In progress"])'
      const query: TaskQueryDto = {
        page: 1,
        limit: 10,
        filters: malformedFilter
      }

      // Simulate high-frequency requests
      const startTime = Date.now()
      const promises = Array.from({ length: 100 }, () => 
        service.getTasksBySheet(mockUser, 'sheet-123', query)
      )
      
      const results = await Promise.all(promises)
      const endTime = Date.now()

      results.forEach(result => {
        expect(result).toBeDefined()
        expect(result.tasks).toEqual(mockTasks)
      })

      expect(endTime - startTime).toBeLessThan(5000) // Should complete in under 5 seconds
    })

    it('should handle memory efficiently with repeated malformed filter processing', async () => {
      jest.spyOn(service as any, 'validateUserAccess').mockResolvedValue(mockRole)
      jest.spyOn(service as any, 'getMemberIdForTaskRetrieval').mockReturnValue(null)

      const mockTasks = [{ id: 'task-1', name: 'Task 1' }]

      jest.spyOn(repository, 'getTasksBySheet').mockResolvedValue({
        tasks: mockTasks,
        pagination: { page: 1, pages: 1, limit: 10, count: 1 }
      })

      const malformedFilter = '["members":[*uuid1]," status" [\'"In progress"])'
      const query: TaskQueryDto = {
        page: 1,
        limit: 10,
        filters: malformedFilter
      }

      const initialMemory = process.memoryUsage().heapUsed

      // Process many requests
      for (let i = 0; i < 1000; i++) {
        await service.getTasksBySheet(mockUser, 'sheet-123', query)
      }

      const finalMemory = process.memoryUsage().heapUsed
      const memoryIncrease = finalMemory - initialMemory

      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024) // Less than 50MB increase
    })
  })
})
