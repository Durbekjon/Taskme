import { ApiProperty } from '@nestjs/swagger'
import { IsArray, IsString, IsNotEmpty, IsNumber } from 'class-validator'

export class ReorderOptionsDto {
  @ApiProperty({
    description: 'The IDs of the options to reorder',
    type: [String],
    example: [
      'c94948db-f38f-47f5-8fae-95db44be3288',
      '21228730-3834-47f5-82fc-a6d1d2240c47',
    ],
  })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  optionIds: string[]

  @ApiProperty({
    description: 'The new orders of the options',
    type: [Number],
    example: [1, 2, 3],
  })
  @IsArray()
  @IsNumber({}, { each: true })
  @IsNotEmpty({ each: true })
  orders: number[]
}
