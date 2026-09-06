import { Injectable } from '@nestjs/common';
import { access, mkdir } from 'fs/promises';
import { constants as fsConstants } from 'fs';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';
import {
  ENTRY_STRUCTURES,
  EntryStructureType,
  PhotoEntryFolder,
} from './entry-structure';

@Injectable()
export class PhotoStorageService {
  private readonly rootPath: string;
  private readonly smbHost: string;
  private readonly smbShare: string;

  constructor(private readonly config: ConfigService) {
    this.rootPath = this.config.get<string>('PHOTO_LIBRARY_PATH');
    this.smbHost = this.config.get<string>('PHOTO_SMB_HOST');
    this.smbShare = this.config.get<string>('PHOTO_SMB_SHARE');
  }

  buildAbsolutePath(relativePath: string): string {
    return join(this.rootPath, relativePath);
  }

  buildWindowsPath(relativePath: string): string {
    const normalized = relativePath.replace(/\//g, '\\');
    return `\\\\${this.smbHost}\\${this.smbShare}\\${normalized}`;
  }

  buildSmbPath(relativePath: string): string {
    const normalized = relativePath.replace(/\\/g, '/');
    return `smb://${this.smbHost}/${this.smbShare}/${normalized}`;
  }

  async exists(relativePath: string): Promise<boolean> {
    try {
      await access(this.buildAbsolutePath(relativePath), fsConstants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  async ensureDirectory(relativePath: string): Promise<void> {
    await mkdir(this.buildAbsolutePath(relativePath), { recursive: true });
  }

  async ensureDirectories(
    relativeRootPath: string,
    directories: string[],
  ): Promise<void> {
    await this.ensureDirectory(relativeRootPath);

    for (const directory of directories) {
      await this.ensureDirectory(`${relativeRootPath}/${directory}`);
    }
  }

  buildAstroObjectFolderName(code?: string, name?: string): string {
    const normalizedCode = code ? this.normalizeFolderSegment(code) : undefined;
    const normalizedName = name ? this.normalizeFolderSegment(name) : undefined;

    if (normalizedCode && normalizedName) {
      return `${normalizedCode}____${normalizedName}`;
    }

    if (normalizedCode) {
      return normalizedCode;
    }

    if (normalizedName) {
      return normalizedName;
    }

    throw new Error('Missing astro object identifier');
  }

  async ensureYearStructure(year: number): Promise<void> {
    const yearPath = `${year}`;

    await this.ensureDirectory(yearPath);

    await this.ensureDirectories(yearPath, [
      '01_MIXED',
      '01_MIXED/01_SOURCE',
      '01_MIXED/01_SOURCE/RAW',
      '01_MIXED/01_SOURCE/JPEG',
      '01_MIXED/01_SOURCE/VIDEO',
      '01_MIXED/02_SELECTS',
      '01_MIXED/03_EDIT',
      '01_MIXED/04_EXPORT',
    ]);
  }

  async ensureAstroObjectStructure(
    code?: string,
    slug?: string,
  ): Promise<string> {
    const objectFolderName = this.buildAstroObjectFolderName(code, slug);
    const rootPath = `ASTRO_OBJECTS/${objectFolderName}`;

    await this.ensureDirectory(rootPath);
    await this.ensureDirectory(`${rootPath}/00_BEST`);
    await this.ensureDirectory(`${rootPath}/01_PUBLISH`);

    return rootPath;
  }

  /** The folders an entry of this type consists of, root-relative and ordered. */
  getEntryStructure(type: EntryStructureType): readonly PhotoEntryFolder[] {
    return ENTRY_STRUCTURES[type];
  }

  async ensureEntryStructure(
    relativeRootPath: string,
    type: EntryStructureType,
  ): Promise<void> {
    await this.ensureDirectories(
      relativeRootPath,
      this.getEntryStructure(type).map((folder) => folder.path),
    );
  }

  async ensureGeneralEntryStructure(relativeRootPath: string): Promise<void> {
    await this.ensureEntryStructure(relativeRootPath, 'general');
  }

  async ensureWorkEntryStructure(relativeRootPath: string): Promise<void> {
    await this.ensureEntryStructure(relativeRootPath, 'work');
  }

  async ensureAstroEntryStructure(relativeRootPath: string): Promise<void> {
    await this.ensureEntryStructure(relativeRootPath, 'astro');
  }

  private normalizeFolderSegment(value: string): string {
    return value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_+/g, '_')
      .toUpperCase();
  }
}
