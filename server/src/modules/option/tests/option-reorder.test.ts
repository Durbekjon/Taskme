/**
 * Comprehensive tests for option reorder functionality
 * Tests drag & drop API and edge cases
 */

import { Test, TestingModule } from '@nestjs/testing'
import { OptionService } from '../option.service'
import { OptionRepository } from '../option.repository'
import { RoleService } from '@role/role.service'
import { UserService } from '@user/user.service'
import { PrismaService } from '@core/prisma/prisma.service'
import { ReorderOptionsDto } from '../dto/reorder-options.dto'
import { BadRequestException, ForbiddenException } from '@nestjs/common'

describe('OptionService - Reorder Options', () => {
  let service: OptionService
  let repository: OptionRepository
  let roleService: RoleService
  let userService: UserService
  let prismaService: PrismaService

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com'
  }

  const mockAuthorRole = {
    type: 'AUTHOR',
    companyId: 'company-123',
    access: { id: 'access-123' }
  }

  const mockMemberRole = {
    type: 'MEMBER',
    companyId: 'company-123',
    access: { id: 'access-123' }
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OptionService,
        {
          provide: OptionRepository,
          useValue: {
            reorderOptions: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            deleteMany: jest.fn(),
          },
        },
        {
          provide: RoleService,
          useValue: {
            getUserSelectedRole: jest.fn(),
          },
        },
        {
          provide: UserService,
          useValue: {
            getUser: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn(),
            option: {
              update: jest.fn(),
              findFirst: jest.fn(),
              create: jest.fn(),
            },
          },
        },
      ],
    }).compile()

    service = module.get<OptionService>(OptionService)
    repository = module.get<OptionRepository>(OptionRepository)
    roleService = module.get<RoleService>(RoleService)
    userService = module.get<UserService>(UserService)
    prismaService = module.get<PrismaService>(PrismaService)
  })

  describe('reorderOptions - Critical Error Cases', () => {
    it('should throw ForbiddenException for non-author users', async () => {
      jest.spyOn(roleService, 'getUserSelectedRole').mockResolvedValue(mockMemberRole)

      const reorderDto: ReorderOptionsDto = {
        optionIds: ['option-1', 'option-2'],
        orders: [2, 1]
      }

      await expect(service.reorderOptions(mockUser, reorderDto))
        .rejects.toThrow(ForbiddenException)
    })

    it('should handle empty optionIds array', async () => {
      jest.spyOn(roleService, 'getUserSelectedRole').mockResolvedValue(mockAuthorRole)

      const reorderDto: ReorderOptionsDto = {
        optionIds: [],
        orders: []
      }

      await expect(service.reorderOptions(mockUser, reorderDto))
        .rejects.toThrow()
    })

    it('should handle mismatched array lengths', async () => {
      jest.spyOn(roleService, 'getUserSelectedRole').mockResolvedValue(mockAuthorRole)

      const reorderDto: ReorderOptionsDto = {
        optionIds: ['option-1', 'option-2', 'option-3'],
        orders: [1, 2] // Missing one order
      }

      await expect(service.reorderOptions(mockUser, reorderDto))
        .rejects.toThrow()
    })

    it('should handle invalid UUIDs in optionIds', async () => {
      jest.spyOn(roleService, 'getUserSelectedRole').mockResolvedValue(mockAuthorRole)

      const reorderDto: ReorderOptionsDto = {
        optionIds: ['invalid-uuid', 'also-invalid'],
        orders: [1, 2]
      }

      // Should not throw during validation, but might fail in database
      jest.spyOn(repository, 'reorderOptions').mockResolvedValue([])
      
      const result = await service.reorderOptions(mockUser, reorderDto)
      expect(result).toEqual({
        status: 'OK',
        result: 'Options reordered successfully'
      })
    })

    it('should handle negative order values', async () => {
      jest.spyOn(roleService, 'getUserSelectedRole').mockResolvedValue(mockAuthorRole)

      const reorderDto: ReorderOptionsDto = {
        optionIds: ['option-1', 'option-2'],
        orders: [-1, -2]
      }

      jest.spyOn(repository, 'reorderOptions').mockResolvedValue([])
      
      const result = await service.reorderOptions(mockUser, reorderDto)
      expect(result).toEqual({
        status: 'OK',
        result: 'Options reordered successfully'
      })
    })

    it('should handle very large order values', async () => {
      jest.spyOn(roleService, 'getUserSelectedRole').mockResolvedValue(mockAuthorRole)

      const reorderDto: ReorderOptionsDto = {
        optionIds: ['option-1', 'option-2'],
        orders: [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER - 1]
      }

      jest.spyOn(repository, 'reorderOptions').mockResolvedValue([])
      
      const result = await service.reorderOptions(mockUser, reorderDto)
      expect(result).toEqual({
        status: 'OK',
        result: 'Options reordered successfully'
      })
    })
  })

  describe('reorderOptions - Edge Cases', () => {
    it('should handle single option reorder', async () => {
      jest.spyOn(roleService, 'getUserSelectedRole').mockResolvedValue(mockAuthorRole)
      jest.spyOn(repository, 'reorderOptions').mockResolvedValue([])

      const reorderDto: ReorderOptionsDto = {
        optionIds: ['option-1'],
        orders: [1]
      }

      const result = await service.reorderOptions(mockUser, reorderDto)
      expect(result).toEqual({
        status: 'OK',
        result: 'Options reordered successfully'
      })
    })

    it('should handle duplicate order values', async () => {
      jest.spyOn(roleService, 'getUserSelectedRole').mockResolvedValue(mockAuthorRole)
      jest.spyOn(repository, 'reorderOptions').mockResolvedValue([])

      const reorderDto: ReorderOptionsDto = {
        optionIds: ['option-1', 'option-2', 'option-3'],
        orders: [1, 1, 1] // All same order
      }

      const result = await service.reorderOptions(mockUser, reorderDto)
      expect(result).toEqual({
        status: 'OK',
        result: 'Options reordered successfully'
      })
    })

    it('should handle duplicate option IDs', async () => {
      jest.spyOn(roleService, 'getUserSelectedRole').mockResolvedValue(mockAuthorRole)
      jest.spyOn(repository, 'reorderOptions').mockResolvedValue([])

      const reorderDto: ReorderOptionsDto = {
        optionIds: ['option-1', 'option-1', 'option-2'],
        orders: [1, 2, 3]
      }

      const result = await service.reorderOptions(mockUser, reorderDto)
      expect(result).toEqual({
        status: 'OK',
        result: 'Options reordered successfully'
      })
    })

    it('should handle large number of options', async () => {
      jest.spyOn(roleService, 'getUserSelectedRole').mockResolvedValue(mockAuthorRole)
      jest.spyOn(repository, 'reorderOptions').mockResolvedValue([])

      const optionIds = Array.from({ length: 1000 }, (_, i) => `option-${i}`)
      const orders = Array.from({ length: 1000 }, (_, i) => i + 1)

      const reorderDto: ReorderOptionsDto = {
        optionIds,
        orders
      }

      const result = await service.reorderOptions(mockUser, reorderDto)
      expect(result).toEqual({
        status: 'OK',
        result: 'Options reordered successfully'
      })
    })
  })

  describe('reorderOptions - Database Transaction Tests', () => {
    it('should handle database transaction failure', async () => {
      jest.spyOn(roleService, 'getUserSelectedRole').mockResolvedValue(mockAuthorRole)
      jest.spyOn(repository, 'reorderOptions').mockRejectedValue(new Error('Database connection failed'))

      const reorderDto: ReorderOptionsDto = {
        optionIds: ['option-1', 'option-2'],
        orders: [2, 1]
      }

      await expect(service.reorderOptions(mockUser, reorderDto))
        .rejects.toThrow('Database connection failed')
    })

    it('should handle partial transaction failure', async () => {
      jest.spyOn(roleService, 'getUserSelectedRole').mockResolvedValue(mockAuthorRole)
      
      // Mock partial failure - some updates succeed, others fail
      jest.spyOn(repository, 'reorderOptions').mockImplementation(async (body) => {
        if (body.optionIds.includes('invalid-option')) {
          throw new Error('Option not found')
        }
        return []
      })

      const reorderDto: ReorderOptionsDto = {
        optionIds: ['option-1', 'invalid-option', 'option-3'],
        orders: [1, 2, 3]
      }

      await expect(service.reorderOptions(mockUser, reorderDto))
        .rejects.toThrow('Option not found')
    })

    it('should handle concurrent reorder requests', async () => {
      jest.spyOn(roleService, 'getUserSelectedRole').mockResolvedValue(mockAuthorRole)
      jest.spyOn(repository, 'reorderOptions').mockResolvedValue([])

      const reorderDto1: ReorderOptionsDto = {
        optionIds: ['option-1', 'option-2'],
        orders: [2, 1]
      }

      const reorderDto2: ReorderOptionsDto = {
        optionIds: ['option-1', 'option-2'],
        orders: [1, 2]
      }

      // Execute concurrent requests
      const [result1, result2] = await Promise.all([
        service.reorderOptions(mockUser, reorderDto1),
        service.reorderOptions(mockUser, reorderDto2)
      ])

      expect(result1).toEqual({
        status: 'OK',
        result: 'Options reordered successfully'
      })
      expect(result2).toEqual({
        status: 'OK',
        result: 'Options reordered successfully'
      })
    })
  })

  describe('reorderOptions - Validation Tests', () => {
    it('should validate user role before processing', async () => {
      jest.spyOn(roleService, 'getUserSelectedRole').mockResolvedValue(null)

      const reorderDto: ReorderOptionsDto = {
        optionIds: ['option-1', 'option-2'],
        orders: [2, 1]
      }

      await expect(service.reorderOptions(mockUser, reorderDto))
        .rejects.toThrow(BadRequestException)
    })

    it('should handle user not found', async () => {
      jest.spyOn(userService, 'getUser').mockResolvedValue(null)
      jest.spyOn(roleService, 'getUserSelectedRole').mockRejectedValue(new Error('User not found'))

      const reorderDto: ReorderOptionsDto = {
        optionIds: ['option-1', 'option-2'],
        orders: [2, 1]
      }

      await expect(service.reorderOptions(mockUser, reorderDto))
        .rejects.toThrow()
    })
  })

  describe('reorderOptions - Performance Tests', () => {
    it('should complete reorder operation within reasonable time', async () => {
      jest.spyOn(roleService, 'getUserSelectedRole').mockResolvedValue(mockAuthorRole)
      jest.spyOn(repository, 'reorderOptions').mockResolvedValue([])

      const reorderDto: ReorderOptionsDto = {
        optionIds: Array.from({ length: 100 }, (_, i) => `option-${i}`),
        orders: Array.from({ length: 100 }, (_, i) => i + 1)
      }

      const startTime = Date.now()
      const result = await service.reorderOptions(mockUser, reorderDto)
      const endTime = Date.now()

      expect(endTime - startTime).toBeLessThan(1000) // Should complete in under 1 second
      expect(result).toEqual({
        status: 'OK',
        result: 'Options reordered successfully'
      })
    })

    it('should handle memory efficiently with large datasets', async () => {
      jest.spyOn(roleService, 'getUserSelectedRole').mockResolvedValue(mockAuthorRole)
      jest.spyOn(repository, 'reorderOptions').mockResolvedValue([])

      const reorderDto: ReorderOptionsDto = {
        optionIds: Array.from({ length: 10000 }, (_, i) => `option-${i}`),
        orders: Array.from({ length: 10000 }, (_, i) => i + 1)
      }

      const initialMemory = process.memoryUsage().heapUsed
      const result = await service.reorderOptions(mockUser, reorderDto)
      const finalMemory = process.memoryUsage().heapUsed

      expect(result).toEqual({
        status: 'OK',
        result: 'Options reordered successfully'
      })
      
      // Memory usage should not increase dramatically
      const memoryIncrease = finalMemory - initialMemory
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024) // Less than 50MB increase
    })
  })
})
