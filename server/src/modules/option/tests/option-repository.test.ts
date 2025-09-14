/**
 * Comprehensive tests for option repository reorder functionality
 * Tests database operations and transaction handling
 */

import { Test, TestingModule } from '@nestjs/testing'
import { OptionRepository } from '../option.repository'
import { PrismaService } from '@core/prisma/prisma.service'
import { ReorderOptionsDto } from '../dto/reorder-options.dto'

describe('OptionRepository - Reorder Options', () => {
  let repository: OptionRepository
  let prismaService: PrismaService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OptionRepository,
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

    repository = module.get<OptionRepository>(OptionRepository)
    prismaService = module.get<PrismaService>(PrismaService)
  })

  describe('reorderOptions - Database Operations', () => {
    it('should execute transaction with correct parameters', async () => {
      const mockTransaction = jest.fn().mockImplementation(async (callback) => {
        return await callback({
          option: {
            update: jest.fn().mockResolvedValue({ id: 'option-1', order: 1 })
          }
        })
      })
      
      jest.spyOn(prismaService, '$transaction').mockImplementation(mockTransaction)

      const reorderDto: ReorderOptionsDto = {
        optionIds: ['option-1', 'option-2'],
        orders: [2, 1]
      }

      await repository.reorderOptions(reorderDto)

      expect(prismaService.$transaction).toHaveBeenCalledWith(expect.any(Function))
    })

    it('should update options with correct order values', async () => {
      const mockUpdate = jest.fn().mockResolvedValue({ id: 'option-1', order: 1 })
      const mockTransaction = jest.fn().mockImplementation(async (callback) => {
        return await callback({
          option: { update: mockUpdate }
        })
      })
      
      jest.spyOn(prismaService, '$transaction').mockImplementation(mockTransaction)

      const reorderDto: ReorderOptionsDto = {
        optionIds: ['option-1', 'option-2', 'option-3'],
        orders: [3, 1, 2]
      }

      await repository.reorderOptions(reorderDto)

      expect(mockUpdate).toHaveBeenCalledTimes(3)
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'option-1' },
        data: { order: 3 }
      })
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'option-2' },
        data: { order: 1 }
      })
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'option-3' },
        data: { order: 2 }
      })
    })

    it('should handle transaction rollback on failure', async () => {
      const mockUpdate = jest.fn()
        .mockResolvedValueOnce({ id: 'option-1', order: 1 })
        .mockRejectedValueOnce(new Error('Database error'))
      
      const mockTransaction = jest.fn().mockImplementation(async (callback) => {
        return await callback({
          option: { update: mockUpdate }
        })
      })
      
      jest.spyOn(prismaService, '$transaction').mockImplementation(mockTransaction)

      const reorderDto: ReorderOptionsDto = {
        optionIds: ['option-1', 'option-2'],
        orders: [2, 1]
      }

      await expect(repository.reorderOptions(reorderDto))
        .rejects.toThrow('Database error')
    })

    it('should handle empty arrays gracefully', async () => {
      const mockTransaction = jest.fn().mockResolvedValue([])
      jest.spyOn(prismaService, '$transaction').mockImplementation(mockTransaction)

      const reorderDto: ReorderOptionsDto = {
        optionIds: [],
        orders: []
      }

      const result = await repository.reorderOptions(reorderDto)
      expect(result).toEqual([])
    })
  })

  describe('reorderOptions - Edge Cases', () => {
    it('should handle single option reorder', async () => {
      const mockUpdate = jest.fn().mockResolvedValue({ id: 'option-1', order: 1 })
      const mockTransaction = jest.fn().mockImplementation(async (callback) => {
        return await callback({
          option: { update: mockUpdate }
        })
      })
      
      jest.spyOn(prismaService, '$transaction').mockImplementation(mockTransaction)

      const reorderDto: ReorderOptionsDto = {
        optionIds: ['option-1'],
        orders: [1]
      }

      await repository.reorderOptions(reorderDto)

      expect(mockUpdate).toHaveBeenCalledTimes(1)
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'option-1' },
        data: { order: 1 }
      })
    })

    it('should handle duplicate option IDs', async () => {
      const mockUpdate = jest.fn().mockResolvedValue({ id: 'option-1', order: 1 })
      const mockTransaction = jest.fn().mockImplementation(async (callback) => {
        return await callback({
          option: { update: mockUpdate }
        })
      })
      
      jest.spyOn(prismaService, '$transaction').mockImplementation(mockTransaction)

      const reorderDto: ReorderOptionsDto = {
        optionIds: ['option-1', 'option-1', 'option-2'],
        orders: [1, 2, 3]
      }

      await repository.reorderOptions(reorderDto)

      expect(mockUpdate).toHaveBeenCalledTimes(3)
      // Should update the same option multiple times
      expect(mockUpdate).toHaveBeenNthCalledWith(1, {
        where: { id: 'option-1' },
        data: { order: 1 }
      })
      expect(mockUpdate).toHaveBeenNthCalledWith(2, {
        where: { id: 'option-1' },
        data: { order: 2 }
      })
      expect(mockUpdate).toHaveBeenNthCalledWith(3, {
        where: { id: 'option-2' },
        data: { order: 3 }
      })
    })

    it('should handle large number of options', async () => {
      const optionIds = Array.from({ length: 1000 }, (_, i) => `option-${i}`)
      const orders = Array.from({ length: 1000 }, (_, i) => i + 1)

      const mockUpdate = jest.fn().mockResolvedValue({ id: 'option-1', order: 1 })
      const mockTransaction = jest.fn().mockImplementation(async (callback) => {
        return await callback({
          option: { update: mockUpdate }
        })
      })
      
      jest.spyOn(prismaService, '$transaction').mockImplementation(mockTransaction)

      const reorderDto: ReorderOptionsDto = {
        optionIds,
        orders
      }

      const startTime = Date.now()
      await repository.reorderOptions(reorderDto)
      const endTime = Date.now()

      expect(mockUpdate).toHaveBeenCalledTimes(1000)
      expect(endTime - startTime).toBeLessThan(5000) // Should complete in under 5 seconds
    })

    it('should handle negative order values', async () => {
      const mockUpdate = jest.fn().mockResolvedValue({ id: 'option-1', order: -1 })
      const mockTransaction = jest.fn().mockImplementation(async (callback) => {
        return await callback({
          option: { update: mockUpdate }
        })
      })
      
      jest.spyOn(prismaService, '$transaction').mockImplementation(mockTransaction)

      const reorderDto: ReorderOptionsDto = {
        optionIds: ['option-1', 'option-2'],
        orders: [-1, -2]
      }

      await repository.reorderOptions(reorderDto)

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'option-1' },
        data: { order: -1 }
      })
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'option-2' },
        data: { order: -2 }
      })
    })

    it('should handle zero order values', async () => {
      const mockUpdate = jest.fn().mockResolvedValue({ id: 'option-1', order: 0 })
      const mockTransaction = jest.fn().mockImplementation(async (callback) => {
        return await callback({
          option: { update: mockUpdate }
        })
      })
      
      jest.spyOn(prismaService, '$transaction').mockImplementation(mockTransaction)

      const reorderDto: ReorderOptionsDto = {
        optionIds: ['option-1', 'option-2'],
        orders: [0, 0]
      }

      await repository.reorderOptions(reorderDto)

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'option-1' },
        data: { order: 0 }
      })
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'option-2' },
        data: { order: 0 }
      })
    })
  })

  describe('reorderOptions - Error Handling', () => {
    it('should handle database connection errors', async () => {
      jest.spyOn(prismaService, '$transaction').mockRejectedValue(new Error('Connection lost'))

      const reorderDto: ReorderOptionsDto = {
        optionIds: ['option-1', 'option-2'],
        orders: [2, 1]
      }

      await expect(repository.reorderOptions(reorderDto))
        .rejects.toThrow('Connection lost')
    })

    it('should handle option not found errors', async () => {
      const mockUpdate = jest.fn()
        .mockResolvedValueOnce({ id: 'option-1', order: 1 })
        .mockRejectedValueOnce(new Error('Record to update not found'))
      
      const mockTransaction = jest.fn().mockImplementation(async (callback) => {
        return await callback({
          option: { update: mockUpdate }
        })
      })
      
      jest.spyOn(prismaService, '$transaction').mockImplementation(mockTransaction)

      const reorderDto: ReorderOptionsDto = {
        optionIds: ['option-1', 'nonexistent-option'],
        orders: [2, 1]
      }

      await expect(repository.reorderOptions(reorderDto))
        .rejects.toThrow('Record to update not found')
    })

    it('should handle constraint violation errors', async () => {
      const mockUpdate = jest.fn().mockRejectedValue(new Error('Unique constraint violation'))
      const mockTransaction = jest.fn().mockImplementation(async (callback) => {
        return await callback({
          option: { update: mockUpdate }
        })
      })
      
      jest.spyOn(prismaService, '$transaction').mockImplementation(mockTransaction)

      const reorderDto: ReorderOptionsDto = {
        optionIds: ['option-1'],
        orders: [1]
      }

      await expect(repository.reorderOptions(reorderDto))
        .rejects.toThrow('Unique constraint violation')
    })

    it('should handle timeout errors', async () => {
      jest.spyOn(prismaService, '$transaction').mockRejectedValue(new Error('Query timeout'))

      const reorderDto: ReorderOptionsDto = {
        optionIds: ['option-1', 'option-2'],
        orders: [2, 1]
      }

      await expect(repository.reorderOptions(reorderDto))
        .rejects.toThrow('Query timeout')
    })
  })

  describe('reorderOptions - Performance Tests', () => {
    it('should handle concurrent transactions', async () => {
      const mockUpdate = jest.fn().mockResolvedValue({ id: 'option-1', order: 1 })
      const mockTransaction = jest.fn().mockImplementation(async (callback) => {
        return await callback({
          option: { update: mockUpdate }
        })
      })
      
      jest.spyOn(prismaService, '$transaction').mockImplementation(mockTransaction)

      const reorderDto1: ReorderOptionsDto = {
        optionIds: ['option-1', 'option-2'],
        orders: [2, 1]
      }

      const reorderDto2: ReorderOptionsDto = {
        optionIds: ['option-3', 'option-4'],
        orders: [4, 3]
      }

      // Execute concurrent transactions
      const [result1, result2] = await Promise.all([
        repository.reorderOptions(reorderDto1),
        repository.reorderOptions(reorderDto2)
      ])

      expect(result1).toBeDefined()
      expect(result2).toBeDefined()
      expect(prismaService.$transaction).toHaveBeenCalledTimes(2)
    })

    it('should handle memory efficiently with large datasets', async () => {
      const optionIds = Array.from({ length: 10000 }, (_, i) => `option-${i}`)
      const orders = Array.from({ length: 10000 }, (_, i) => i + 1)

      const mockUpdate = jest.fn().mockResolvedValue({ id: 'option-1', order: 1 })
      const mockTransaction = jest.fn().mockImplementation(async (callback) => {
        return await callback({
          option: { update: mockUpdate }
        })
      })
      
      jest.spyOn(prismaService, '$transaction').mockImplementation(mockTransaction)

      const reorderDto: ReorderOptionsDto = {
        optionIds,
        orders
      }

      const initialMemory = process.memoryUsage().heapUsed
      await repository.reorderOptions(reorderDto)
      const finalMemory = process.memoryUsage().heapUsed

      const memoryIncrease = finalMemory - initialMemory
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024) // Less than 100MB increase
    })
  })
})
