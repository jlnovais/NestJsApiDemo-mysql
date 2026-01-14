import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

// Type definition for multer file
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
  destination?: string;
  filename?: string;
  path?: string;
}

@Injectable()
export class StorageService {
  private s3Client: S3Client;
  private bucketName: string;
  private namespace: string;

  constructor(private configService: ConfigService) {
    // Get configuration from environment variables
    const region =
      this.configService.get<string>('OCI_REGION') || 'us-ashburn-1';
    const accessKeyId = this.configService.get<string>('OCI_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'OCI_SECRET_ACCESS_KEY',
    );
    const endpoint = this.configService.get<string>('OCI_S3_ENDPOINT');
    this.bucketName =
      this.configService.get<string>('OCI_BUCKET_NAME') || 'employee-photos';
    this.namespace = this.configService.get<string>('OCI_NAMESPACE', '');

    if (!accessKeyId || !secretAccessKey) {
      throw new Error(
        'OCI_ACCESS_KEY_ID and OCI_SECRET_ACCESS_KEY must be set in environment variables',
      );
    }

    if (!endpoint && !this.namespace) {
      throw new Error(
        'Either OCI_S3_ENDPOINT or OCI_NAMESPACE must be set in environment variables',
      );
    }

    // Construct endpoint if not provided
    const s3Endpoint =
      endpoint ||
      `https://${this.namespace}.compat.objectstorage.${region}.oraclecloud.com`;

    // Initialize S3 client with OCI Object Storage (S3-compatible)
    this.s3Client = new S3Client({
      region,
      endpoint: s3Endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true, // Required for OCI Object Storage
    });
  }

  /**
   * Upload a file to OCI Object Storage
   * @param file - The file to upload (from multer)
   * @param folder - Optional folder path within the bucket
   * @returns The public URL of the uploaded file
   */
  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'employees',
  ): Promise<string> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Use local type to avoid type resolution issues
    const fileData = file as unknown as MulterFile;

    // Validate file type
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
    ];
    if (!allowedMimeTypes.includes(fileData.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`,
      );
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (fileData.size > maxSize) {
      throw new BadRequestException('File size exceeds 5MB limit');
    }

    // Generate unique filename
    const fileExtension = fileData.originalname.split('.').pop();
    const fileName = `${folder}/${uuidv4()}.${fileExtension}`;

    try {
      // Upload to OCI Object Storage
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fileName,
        Body: fileData.buffer,
        ContentType: fileData.mimetype,
        // Make the object publicly readable (optional, adjust based on your needs)
        // ACL: 'public-read', // OCI may not support ACL, use IAM policies instead
      });

      await this.s3Client.send(command);

      // Construct the public URL
      // For OCI, the URL format is: https://namespace.compat.objectstorage.region.oraclecloud.com/bucket-name/object-key
      const region = this.configService.get<string>('OCI_REGION', 'unknown');
      const endpoint =
        this.configService.get<string>('OCI_S3_ENDPOINT') ||
        `https://${this.namespace}.compat.objectstorage.${region}.oraclecloud.com`;

      // Construct public URL
      const publicUrl = `${endpoint}/${this.bucketName}/${fileName}`;

      return publicUrl;
    } catch (error) {
      console.error('Error uploading file to OCI Object Storage:', error);
      throw new BadRequestException(
        `Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Delete a file from OCI Object Storage
   * @param fileUrl - The URL of the file to delete
   */
  async deleteFile(fileUrl: string): Promise<void> {
    try {
      // Extract the key from the URL
      // URL format: https://namespace.compat.objectstorage.region.oraclecloud.com/bucket-name/object-key
      const urlParts = fileUrl.split('/');
      const key = urlParts.slice(-2).join('/'); // Get last two parts (folder/filename)

      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
    } catch (error) {
      console.error('Error deleting file from OCI Object Storage:', error);
      // Don't throw error, just log it (file might not exist)
    }
  }

  /**
   * Extract file key from URL for deletion
   * @param fileUrl - The full URL of the file
   * @returns The key (path) of the file in the bucket
   */
  extractKeyFromUrl(fileUrl: string): string {
    // URL format: https://namespace.compat.objectstorage.region.oraclecloud.com/bucket-name/folder/filename
    const urlParts = fileUrl.split('/');
    const bucketIndex = urlParts.findIndex((part) => part === this.bucketName);
    if (bucketIndex === -1) {
      throw new BadRequestException('Invalid file URL format');
    }
    return urlParts.slice(bucketIndex + 1).join('/');
  }
}
