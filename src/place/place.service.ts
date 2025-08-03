import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto } from '../common/dto';
import { PlaceType, Prisma } from '@prisma/client';
import { PlaceAddMemberDto, PlaceCreateDto, PlaceUpdateDto } from './dto';
import {
  PlaceDetailResponseDto,
  PlaceListResponseDto,
  PlaceMemberListResponseDto,
} from './responses';

@Injectable()
export class PlaceService {
  constructor(private readonly prisma: PrismaService) {}

  async listPlaces(
    userId: string,
    params?: PaginationDto,
  ): Promise<PlaceListResponseDto> {
    const { skip = 0, take = 50 } = params || {};

    const [places, total] = await this.prisma.$transaction([
      this.prisma.place.findMany({
        where: {
          OR: [{ ownerId: userId }, { members: { some: { userId } } }],
        },
        skip,
        take,
        include: { location: true, aiContext: true, members: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.place.count({
        where: {
          OR: [{ ownerId: userId }, { members: { some: { userId } } }],
        },
      }),
    ]);

    return {
      places,
      total,
      params: params || { skip, take },
    };
  }

  async getPlace(userId: string, id: string): Promise<PlaceDetailResponseDto> {
    const place = await this.findAccessiblePlace(userId, id);
    return place;
  }

  async createPlace(
    userId: string,
    dto: PlaceCreateDto,
  ): Promise<PlaceDetailResponseDto> {
    let locationId: string | undefined;

    if (dto.location) {
      const location = await this.prisma.location.create({
        data: {
          ...dto.location,
          createdBy: { connect: { id: userId } },
        },
      });
      locationId = location.id;
    }

    const place = await this.prisma.place.create({
      data: {
        name: dto.name,
        description: dto.description,
        type: dto.type,
        ownerId: userId,
        locationId,
      },
      include: { location: true },
    });

    return place;
  }

  async updatePlace(
    userId: string,
    id: string,
    dto: PlaceUpdateDto,
  ): Promise<PlaceDetailResponseDto> {
    const place = await this.prisma.place.findUnique({
      where: { id },
      include: { location: true, aiContext: true, members: true },
    });
    if (!place) throw new NotFoundException('Place not found');
    if (place.ownerId !== userId)
      throw new ForbiddenException('Only owner can update place');

    let locationId = place.locationId;
    if (dto.location) {
      if (locationId) {
        const updatedLocation = await this.prisma.location.update({
          where: { id: locationId },
          data: dto.location,
        });
        locationId = updatedLocation.id;
      } else {
        const createdLocation = await this.prisma.location.create({
          data: {
            ...dto.location,
            createdBy: { connect: { id: userId } },
          },
        });
        locationId = createdLocation.id;
      }
    }

    const updatedPlace = await this.prisma.place.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        type: dto.type,
        locationId,
      },
      include: { location: true, aiContext: true, members: true },
    });

    return updatedPlace;
  }

  async deletePlaceWithFailsafe(userId: string, placeId: string) {
    const place = await this.prisma.place.findUnique({
      where: { id: placeId },
      include: { members: true },
    });
    if (!place) throw new NotFoundException('Place not found');

    if (place.ownerId === userId) {
      await this.prisma.place.delete({ where: { id: placeId } });
      return { deleted: true, type: 'place' as const };
    }

    const member = place.members.find((m) => m.userId === userId);
    if (member) {
      await this.prisma.placeMember.delete({ where: { id: member.id } });
      return { deleted: true, type: 'membership' as const };
    }

    throw new ForbiddenException(
      'You are neither the owner nor a member of this place',
    );
  }

  private async findAccessiblePlace(userId: string, id: string) {
    const place = await this.prisma.place.findUnique({
      where: { id },
      include: { location: true, aiContext: true, members: true },
    });
    if (
      !place ||
      (place.ownerId !== userId &&
        !place.members.some((m) => m.userId === userId))
    ) {
      throw new NotFoundException('Place not found');
    }
    return place;
  }

  async listMembers(
    userId: string,
    placeId: string,
  ): Promise<PlaceMemberListResponseDto> {
    const place = await this.findAccessiblePlace(userId, placeId);
    const members = await this.prisma.placeMember.findMany({
      where: { placeId },
      include: { user: true },
      orderBy: { joinedAt: 'asc' },
    });
    return {
      members: members.map((m) => ({
        id: m.id,
        user: m.user,
        joinedAt: m.joinedAt,
        role: m.role,
      })),
      total: members.length,
    };
  }

  async addMember(
    userId: string,
    placeId: string,
    dto: PlaceAddMemberDto,
  ): Promise<PlaceMemberListResponseDto> {
    const place = await this.prisma.place.findUnique({
      where: { id: placeId },
    });
    if (!place) throw new NotFoundException('Place not found');
    if (place.ownerId !== userId)
      throw new ForbiddenException('Only owner can add members');

    const existing = await this.prisma.placeMember.findUnique({
      where: { placeId_userId: { placeId, userId: dto.userId } },
    });
    if (existing) throw new BadRequestException('User is already a member');

    await this.prisma.placeMember.create({
      data: {
        placeId,
        userId: dto.userId,
        role: dto.role,
      },
    });

    return this.listMembers(userId, placeId);
  }

  async removeMember(
    userId: string,
    placeId: string,
    memberId: string,
  ): Promise<PlaceMemberListResponseDto> {
    const place = await this.prisma.place.findUnique({
      where: { id: placeId },
    });
    if (!place) throw new NotFoundException('Place not found');
    if (place.ownerId !== userId)
      throw new ForbiddenException('Only owner can remove members');

    const member = await this.prisma.placeMember.findUnique({
      where: { id: memberId },
    });
    if (!member) throw new NotFoundException('Member not found');
    if (member.userId === userId)
      throw new BadRequestException('Owner cannot remove self');

    await this.prisma.placeMember.delete({ where: { id: memberId } });
    return this.listMembers(userId, placeId);
  }
}
