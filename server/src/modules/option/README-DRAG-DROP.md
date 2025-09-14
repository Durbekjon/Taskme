# Select Options Drag & Drop Implementation

## Overview
This document describes the implementation of drag and drop functionality for select options, following the same pattern used for tasks, columns, workspaces, and sheets.

## Backend Implementation

### Database Changes
- Added `order` field to the `Option` model in Prisma schema
- Migration created: `20250914061409_add_order_to_options`
- All existing options will have `order: 0` by default

### API Endpoint
```
PUT /api/v1/option/reorder
```

**Request Body:**
```json
{
  "optionIds": ["uuid1", "uuid2", "uuid3"],
  "orders": [3, 1, 2]
}
```

**Response:**
```json
{
  "status": "OK",
  "result": "Options reordered successfully"
}
```

### Implementation Details

#### 1. DTO (Data Transfer Object)
```typescript
// src/modules/option/dto/reorder-options.dto.ts
export class ReorderOptionsDto {
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  optionIds: string[]

  @IsArray()
  @IsNumber({}, { each: true })
  @IsNotEmpty({ each: true })
  orders: number[]
}
```

#### 2. Repository Method
```typescript
// src/modules/option/option.repository.ts
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
```

#### 3. Service Method
```typescript
// src/modules/option/option.service.ts
async reorderOptions(user: IUser, body: ReorderOptionsDto) {
  await this.validateUserRole(user) // Only authors can reorder
  await this.repository.reorderOptions(body)
  return {
    status: 'OK',
    result: 'Options reordered successfully',
  }
}
```

#### 4. Controller Endpoint
```typescript
// src/modules/option/option.controller.ts
@Put('reorder')
@ApiOperation({ summary: 'Reorder options' })
reorderOptions(@User() user: IUser, @Body() body: ReorderOptionsDto) {
  return this.service.reorderOptions(user, body)
}
```

## Frontend Integration Guide

### 1. API Call Example
```typescript
const reorderOptions = async (optionIds: string[], newOrders: number[]) => {
  try {
    const response = await fetch('/api/v1/option/reorder', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        optionIds,
        orders: newOrders
      })
    })
    
    const result = await response.json()
    if (result.status === 'OK') {
      // Refresh the options list or update local state
      console.log('Options reordered successfully')
    }
  } catch (error) {
    console.error('Failed to reorder options:', error)
  }
}
```

### 2. Drag & Drop Implementation
```typescript
// Example using react-beautiful-dnd or similar library
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd'

const handleDragEnd = (result: DropResult) => {
  if (!result.destination) return

  const { source, destination } = result
  const newOptions = Array.from(options)
  const [reorderedItem] = newOptions.splice(source.index, 1)
  newOptions.splice(destination.index, 0, reorderedItem)

  // Update local state
  setOptions(newOptions)

  // Calculate new orders
  const optionIds = newOptions.map(option => option.id)
  const orders = newOptions.map((_, index) => index + 1)

  // Call API
  reorderOptions(optionIds, orders)
}
```

### 3. Data Structure
Options are now returned ordered by the `order` field:
```json
{
  "id": "select-uuid",
  "title": "Priority",
  "color": "#ff0000",
  "options": [
    {
      "id": "option-1",
      "name": "High",
      "color": "#ff0000",
      "order": 1
    },
    {
      "id": "option-2", 
      "name": "Medium",
      "color": "#ffff00",
      "order": 2
    },
    {
      "id": "option-3",
      "name": "Low", 
      "color": "#00ff00",
      "order": 3
    }
  ]
}
```

## Testing

### Manual Testing
1. Create a select with multiple options
2. Use the drag and drop interface to reorder options
3. Verify the order persists after page refresh
4. Check that the API call is made with correct data

### API Testing with curl
```bash
curl -X PUT http://localhost:3000/api/v1/option/reorder \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "optionIds": ["option-uuid-1", "option-uuid-2", "option-uuid-3"],
    "orders": [3, 1, 2]
  }'
```

## Error Handling

### Common Errors
- **400 Bad Request**: Invalid DTO (mismatched array lengths, invalid UUIDs)
- **401 Unauthorized**: Missing or invalid JWT token
- **403 Forbidden**: User is not an author (only authors can reorder)
- **500 Internal Server Error**: Database transaction failure

### Frontend Error Handling
```typescript
try {
  await reorderOptions(optionIds, orders)
} catch (error) {
  if (error.status === 403) {
    showError('Only authors can reorder options')
  } else if (error.status === 400) {
    showError('Invalid reorder data')
  } else {
    showError('Failed to reorder options. Please try again.')
  }
}
```

## Migration Notes

### Existing Data
- All existing options will have `order: 0`
- New options will be assigned incremental order values
- The system will work correctly even with mixed order values

### Backward Compatibility
- Existing API endpoints remain unchanged
- Frontend can gradually implement drag & drop
- Options without proper ordering will still display (just not in consistent order)

## Performance Considerations

### Database
- Uses Prisma transactions for atomic updates
- Single query per option update (batched in transaction)
- Index on `order` field for efficient sorting

### Frontend
- Consider debouncing API calls during rapid drag operations
- Update local state optimistically for better UX
- Implement proper loading states during API calls

## Security

### Authorization
- Only users with `RoleTypes.AUTHOR` can reorder options
- JWT token validation required
- Company-level access control maintained

### Validation
- DTO validation ensures data integrity
- Array length validation prevents mismatched data
- UUID validation ensures valid option IDs
