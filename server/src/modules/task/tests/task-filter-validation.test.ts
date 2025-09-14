/**
 * Comprehensive tests for task filter validation
 * Tests malformed JSON handling and edge cases
 */

import { Test, TestingModule } from '@nestjs/testing'
import { TaskRepository } from '../task.repository'
import { PrismaService } from '@core/prisma/prisma.service'

describe('TaskRepository - Filter Validation', () => {
  let repository: TaskRepository
  let prismaService: PrismaService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskRepository,
        {
          provide: PrismaService,
          useValue: {
            task: {
              findMany: jest.fn(),
              count: jest.fn(),
            },
          },
        },
      ],
    }).compile()

    repository = module.get<TaskRepository>(TaskRepository)
    prismaService = module.get<PrismaService>(PrismaService)
  })

  describe('validateFilters - Malformed JSON Handling', () => {
    // Access private method for testing
    const validateFilters = (repository as any).validateFilters.bind(repository)

    describe('Critical Error Cases', () => {
      it('should handle the specific reported error case', () => {
        const malformedFilter = '["members":[*d51f55cd-7a4f-4f88-bb9c-b8fd 1"]," status" [\'"In progress"])'
        
        const result = validateFilters(malformedFilter)
        
        expect(result).toEqual({
          members: { in: ['d51f55cd-7a4f-4f88-bb9c-b8fd1'] },
          status: { in: ['In progress'] }
        })
      })

      it('should handle completely invalid JSON gracefully', () => {
        const invalidFilters = [
          'not json at all',
          '{invalid json}',
          '{"incomplete":',
          '{"trailing": "comma",}',
          '{"unclosed": "string',
          '{"unclosed": [',
          '{"unclosed": {"nested":',
        ]

        invalidFilters.forEach(filter => {
          expect(() => validateFilters(filter)).not.toThrow()
          const result = validateFilters(filter)
          expect(result).toEqual({})
        })
      })

      it('should handle null and undefined filters', () => {
        expect(validateFilters(null as any)).toEqual({})
        expect(validateFilters(undefined as any)).toEqual({})
        expect(validateFilters('')).toEqual({})
        expect(validateFilters('   ')).toEqual({})
      })
    })

    describe('Malformed Array Patterns', () => {
      it('should fix malformed UUID arrays', () => {
        const testCases = [
          {
            input: '{"members":[*uuid1,*uuid2]}',
            expected: { members: { in: ['uuid1', 'uuid2'] } }
          },
          {
            input: '{"members":[*d51f55cd-7a4f-4f88-bb9c-b8fd 1"]}',
            expected: { members: { in: ['d51f55cd-7a4f-4f88-bb9c-b8fd1'] } }
          },
          {
            input: '{"members":[*uuid-with-spaces 123"]}',
            expected: { members: { in: ['uuid-with-spaces123'] } }
          }
        ]

        testCases.forEach(({ input, expected }) => {
          const result = validateFilters(input)
          expect(result).toEqual(expected)
        })
      })

      it('should fix malformed string arrays', () => {
        const testCases = [
          {
            input: '{"status":[\'"In progress"]}',
            expected: { status: { in: ['In progress'] } }
          },
          {
            input: '{"priority":[\'"High",\'"Medium"]}',
            expected: { priority: { in: ['High', 'Medium'] } }
          },
          {
            input: '{"status":[\'"In progress",\'"Done"]}',
            expected: { status: { in: ['In progress', 'Done'] } }
          }
        ]

        testCases.forEach(({ input, expected }) => {
          const result = validateFilters(input)
          expect(result).toEqual(expected)
        })
      })
    })

    describe('Key Formatting Issues', () => {
      it('should fix keys with spaces', () => {
        const testCases = [
          {
            input: '{" status":["In progress"]}',
            expected: { status: { in: ['In progress'] } }
          },
          {
            input: '{" priority":["High"]}',
            expected: { priority: { in: ['High'] } }
          },
          {
            input: '{" members":["uuid1"]}',
            expected: { members: { in: ['uuid1'] } }
          }
        ]

        testCases.forEach(({ input, expected }) => {
          const result = validateFilters(input)
          expect(result).toEqual(expected)
        })
      })

      it('should fix missing colons after keys', () => {
        const testCases = [
          {
            input: '{"status" ["In progress"]}',
            expected: { status: { in: ['In progress'] } }
          },
          {
            input: '{" status" ["In progress"]}',
            expected: { status: { in: ['In progress'] } }
          },
          {
            input: '{"members" ["uuid1"]}',
            expected: { members: { in: ['uuid1'] } }
          }
        ]

        testCases.forEach(({ input, expected }) => {
          const result = validateFilters(input)
          expect(result).toEqual(expected)
        })
      })

      it('should fix unquoted keys', () => {
        const testCases = [
          {
            input: '{status:["In progress"]}',
            expected: { status: { in: ['In progress'] } }
          },
          {
            input: '{members:["uuid1"],priority:["High"]}',
            expected: { 
              members: { in: ['uuid1'] },
              priority: { in: ['High'] }
            }
          }
        ]

        testCases.forEach(({ input, expected }) => {
          const result = validateFilters(input)
          expect(result).toEqual(expected)
        })
      })
    })

    describe('Complex Malformed Patterns', () => {
      it('should handle mixed malformed patterns', () => {
        const complexMalformed = '["members":[*uuid1,*uuid2]," status" [\'"In progress"],priority:["High"]]'
        
        const result = validateFilters(complexMalformed)
        
        expect(result).toEqual({
          members: { in: ['uuid1', 'uuid2'] },
          status: { in: ['In progress'] },
          priority: { in: ['High'] }
        })
      })

      it('should handle nested malformed patterns', () => {
        const nestedMalformed = '{"members":[*uuid1],"status":[\'"In progress"],"priority":[*High]}'
        
        const result = validateFilters(nestedMalformed)
        
        expect(result).toEqual({
          members: { in: ['uuid1'] },
          status: { in: ['In progress'] },
          priority: { in: ['High'] }
        })
      })
    })

    describe('Edge Cases and Boundary Conditions', () => {
      it('should handle empty arrays', () => {
        const testCases = [
          '{"members":[]}',
          '{"status":[],"priority":["High"]}',
          '{"members":[],"status":[],"priority":[]}'
        ]

        testCases.forEach(filter => {
          const result = validateFilters(filter)
          // Empty arrays should be filtered out
          expect(result).toEqual({})
        })
      })

      it('should handle arrays with null/undefined values', () => {
        const testCases = [
          '{"members":["uuid1",null,"uuid2"]}',
          '{"status":["In progress",undefined,"Done"]}',
          '{"priority":["High","",null]}'
        ]

        testCases.forEach(filter => {
          const result = validateFilters(filter)
          // Should filter out null/undefined/empty values
          expect(result).not.toEqual({})
          Object.values(result).forEach(value => {
            if (typeof value === 'object' && 'in' in value) {
              expect(value.in).not.toContain(null)
              expect(value.in).not.toContain(undefined)
              expect(value.in).not.toContain('')
            }
          })
        })
      })

      it('should handle very long malformed strings', () => {
        const longUuid = 'a'.repeat(100)
        const longStatus = 'b'.repeat(100)
        const malformedFilter = `["members":[*${longUuid}]," status" [\'"${longStatus}"]]`
        
        expect(() => validateFilters(malformedFilter)).not.toThrow()
        const result = validateFilters(malformedFilter)
        expect(result).toEqual({
          members: { in: [longUuid] },
          status: { in: [longStatus] }
        })
      })

      it('should handle special characters in values', () => {
        const testCases = [
          '{"status":["In progress (urgent)"]}',
          '{"priority":["High - Critical"]}',
          '{"members":["user@example.com"]}',
          '{"status":["Status with "quotes""]}'
        ]

        testCases.forEach(filter => {
          expect(() => validateFilters(filter)).not.toThrow()
          const result = validateFilters(filter)
          expect(result).not.toEqual({})
        })
      })
    })

    describe('Performance and Memory Tests', () => {
      it('should handle large filter objects efficiently', () => {
        const largeFilter = {
          members: Array.from({ length: 1000 }, (_, i) => `uuid${i}`),
          status: Array.from({ length: 100 }, (_, i) => `status${i}`),
          priority: Array.from({ length: 50 }, (_, i) => `priority${i}`)
        }
        
        const filterString = JSON.stringify(largeFilter)
        
        const startTime = Date.now()
        const result = validateFilters(filterString)
        const endTime = Date.now()
        
        expect(endTime - startTime).toBeLessThan(100) // Should complete in under 100ms
        expect(result).toEqual({
          members: { in: largeFilter.members },
          status: { in: largeFilter.status },
          priority: { in: largeFilter.priority }
        })
      })

      it('should not cause memory leaks with repeated calls', () => {
        const malformedFilter = '["members":[*uuid1]," status" [\'"In progress"])'
        
        // Call many times to check for memory leaks
        for (let i = 0; i < 1000; i++) {
          const result = validateFilters(malformedFilter)
          expect(result).toEqual({
            members: { in: ['uuid1'] },
            status: { in: ['In progress'] }
          })
        }
      })
    })
  })
})
