import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Public } from '../../common/public.decorator';
import { Roles } from '../../common/roles.decorator';
import { ServiceCategory, ServiceItem, UserRole } from '../../entities';
import { ServiceItemDto } from './dto';

@ApiTags('服务项目目录')
@Controller('service-items')
export class ServiceItemsController {
  constructor(
    @InjectRepository(ServiceItem) private items: Repository<ServiceItem>,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: '服务项目列表' })
  list(@Query('category') category?: ServiceCategory, @Query('all') all?: string) {
    const where: any = {};
    if (category) where.category = category;
    if (all !== 'true') where.active = true;
    return this.items.find({ where, order: { category: 'ASC', code: 'ASC' } });
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '新增服务项目（管理端）' })
  create(@Body() dto: ServiceItemDto) {
    return this.items.save(this.items.create(dto));
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '修改服务项目（管理端）' })
  async update(@Param('id') id: string, @Body() dto: Partial<ServiceItemDto>) {
    await this.items.update(id, dto);
    return this.items.findOne({ where: { id } });
  }
}
