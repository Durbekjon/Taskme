import { PrismaService } from '@core/prisma/prisma.service'
import { Injectable } from '@nestjs/common'
import { CreateOptionDto } from './dto/create-option.dto'
import { UpdateOptionDto } from './dto/uptdate-option.dto'
import { ReorderOptionsDto } from './dto/reorder-options.dto'
import { HTTP_MESSAGES } from '@consts/http-messages'

@Injectable()
export class OptionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(body: CreateOptionDto) {
    // Get the highest order for this select
    const lastOption = await this.prisma.option.findFirst({
      where: { selectId: body.selectId },
      orderBy: { order: 'desc' },
      select: { order: true },
    })

    const nextOrder = lastOption ? lastOption.order + 1 : 1

    return this.prisma.option.create({
      data: {
        name: body.name,
        color: body.color,
        order: nextOrder,
        select: { connect: { id: body.selectId } },
      },
    })
  }

  findOne(id: string) {
    return this.prisma.option.findUnique({ where: { id } })
  }

  update(optionId: string, body: UpdateOptionDto) {
    return this.prisma.option.update({
      where: { id: optionId },
      data: { name: body.name, color: body.color },
    })
  }
  async delete(optionId: string) {
    await this.prisma.option.delete({ where: { id: optionId } })

    return {
      status: 'OK',
      result: HTTP_MESSAGES.OPTION.DELETE_SUCCESS,
    }
  }

  deleteMany(selectId: string) {
    return this.prisma.option.deleteMany({ where: { selectId } })
  }

  async reorderOptions(body: ReorderOptionsDto) {
    return this.prisma.$transaction(async (tx) => {
      const updatePromises = body.optionIds.map((optionId, index) =>
        tx.option.update({
          where: { id: optionId },
          data: { order: body.orders[index] },
        }),
      )

      return Promise.all(updatePromises)
    })
  }
}
