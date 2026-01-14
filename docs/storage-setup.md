# Employee Photo Storage Setup Guide

This guide explains how to configure OCI Object Storage for employee photo uploads in the NestJS application.

## Prerequisites

1. Oracle Cloud Infrastructure (OCI) Free Tier account
2. OCI Object Storage bucket created
3. Customer Secret Key generated for S3-compatible API access

## Environment Variables

Add the following environment variables to your `.env` file:

```env
# OCI Object Storage Configuration (S3-Compatible)
OCI_REGION=us-ashburn-1
OCI_NAMESPACE=your-namespace-here
OCI_BUCKET_NAME=employee-photos
OCI_ACCESS_KEY_ID=your-access-key-id-here
OCI_SECRET_ACCESS_KEY=your-secret-access-key-here

# Optional: If you want to specify the full endpoint URL
# OCI_S3_ENDPOINT=https://your-namespace.compat.objectstorage.us-ashburn-1.oraclecloud.com
```

### Environment Variable Descriptions

- **OCI_REGION**: Your OCI region (e.g., `us-ashburn-1`, `us-phoenix-1`, `eu-frankfurt-1`)
- **OCI_NAMESPACE**: Your OCI namespace (found in Object Storage console)
- **OCI_BUCKET_NAME**: Name of your Object Storage bucket
- **OCI_ACCESS_KEY_ID**: Access Key ID from your Customer Secret Key
- **OCI_SECRET_ACCESS_KEY**: Secret Access Key from your Customer Secret Key
- **OCI_S3_ENDPOINT**: (Optional) Full S3-compatible endpoint URL. If not provided, it will be constructed from namespace and region.

## Database Migration

Run the database migration to add the `photoUrl` column:

```bash
mysql -u root -p < database-migration-add-photo-url.sql
```

Or manually execute:

```sql
USE testdb;
ALTER TABLE Employee 
ADD COLUMN photoUrl VARCHAR(500) NULL AFTER role;
```

## API Endpoints

### Upload Employee Photo

**POST** `/employees/:id/photo`

Upload a profile photo for an employee.

- **Content-Type**: `multipart/form-data`
- **File field**: `file`
- **Accepted formats**: JPEG, PNG, WebP
- **Max file size**: 5MB

**Example using curl:**

```bash
curl -X POST \
  http://localhost:3000/employees/1/photo \
  -H "Cookie: connect.sid=your-session-cookie" \
  -F "file=@/path/to/photo.jpg"
```

**Example using Postman:**
1. Method: POST
2. URL: `http://localhost:3000/employees/1/photo`
3. Body: form-data
4. Key: `file` (type: File)
5. Value: Select your image file

### Delete Employee Photo

**DELETE** `/employees/:id/photo`

Remove the profile photo for an employee.

**Example using curl:**

```bash
curl -X DELETE \
  http://localhost:3000/employees/1/photo \
  -H "Cookie: connect.sid=your-session-cookie"
```

## File Storage Details

- **Storage Location**: OCI Object Storage (S3-compatible)
- **Folder Structure**: Files are stored in `employees/` folder within the bucket
- **File Naming**: Files are automatically renamed using UUID to prevent conflicts
- **Public Access**: Photos are stored with public read access (configure IAM policies in OCI)

## Security Considerations

1. **Authentication**: All photo upload/delete endpoints require authentication (SessionGuard)
2. **File Validation**: Only image files (JPEG, PNG, WebP) are accepted
3. **Size Limit**: Maximum file size is 5MB
4. **IAM Policies**: Configure OCI IAM policies to control bucket access

## Troubleshooting

### Error: "OCI_ACCESS_KEY_ID and OCI_SECRET_ACCESS_KEY must be set"
- Make sure all required environment variables are set in your `.env` file
- Restart your application after adding environment variables

### Error: "Invalid file type"
- Only JPEG, PNG, and WebP images are accepted
- Check the file's MIME type

### Error: "File size exceeds 5MB limit"
- Compress or resize the image before uploading
- Maximum allowed size is 5MB

### Error: "Failed to upload file"
- Verify your OCI credentials are correct
- Check that the bucket exists and is accessible
- Ensure IAM policies allow object creation in the bucket

## Testing

After setup, you can test the photo upload functionality:

1. Start your NestJS application
2. Authenticate and get a session cookie
3. Create or get an employee ID
4. Upload a photo using the POST endpoint
5. Verify the photo URL is returned in the employee response
6. Check that the photo is accessible via the returned URL

## Free Tier Limits

- **Storage**: 10 GB of Object Storage
- **Data Transfer**: 10 GB/month outbound data transfer
- Monitor your usage in the OCI Console to stay within limits
