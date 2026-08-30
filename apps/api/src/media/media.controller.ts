import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { loadEnv } from '@slay/config';
import { JwtAuthGuard } from '../common/jwt-auth.guard.js';
import { PermissionsGuard } from '../common/permissions.guard.js';
import { RequirePermissions } from '../common/decorators.js';
import { MediaService } from './media.service.js';

const env = loadEnv();

class PresignDto {
  @IsString() filename!: string;
  @IsString() contentType!: string;
  @IsOptional() @IsIn(['products', 'banners', 'brands', 'blog', 'lookbooks']) folder?: string;
}

@ApiTags('admin-media')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('admin/media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Get('config')
  @RequirePermissions('product:read')
  config() {
    return this.media.config();
  }

  @Post('upload')
  @RequirePermissions('product:update')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: env.MEDIA_MAX_MB * 1024 * 1024 } }),
  )
  async upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided (field name: "file")');
    return this.media.store(
      { buffer: file.buffer, mimetype: file.mimetype, size: file.size, originalname: file.originalname },
      'products',
    );
  }

  @Post('presign')
  @RequirePermissions('product:update')
  presign(@Body() dto: PresignDto) {
    return this.media.presignUpload(dto);
  }
}
