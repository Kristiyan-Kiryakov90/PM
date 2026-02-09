/**
 * Attachment Service
 * Handles file upload, download, and deletion for task attachments
 */

import supabase from './supabase.js';
import { getCurrentUser } from '../utils/auth.js';

const STORAGE_BUCKET = 'task-attachments';
const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB limit

/**
 * Upload attachment to a task
 * @param {number} taskId - Task ID
 * @param {File} file - File to upload
 * @returns {Promise<Object>} - Uploaded attachment record
 */
export async function uploadAttachment(taskId, file) {
  try {
    // Validate file size (1MB limit)
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File size exceeds maximum of 1MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB.`);
    }

    const user = await getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const companyId = user.user_metadata?.company_id || null;

    // Generate unique file path (bucket name NOT included in path)
    const fileExt = file.name.split('.').pop();
    const fileName = file.name;
    const randomId = Math.random().toString(36).substring(2, 15);
    const filePath = `${taskId}/${randomId}.${fileExt}`;

    // Upload file to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error(uploadError.message || 'Failed to upload file');
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filePath);

    const fileUrl = urlData.publicUrl;

    // Create attachment record in database
    const { data: attachment, error: dbError } = await supabase
      .from('attachments')
      .insert({
        company_id: companyId,
        task_id: taskId,
        file_name: fileName,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.type || 'application/octet-stream',
        uploaded_by: user.id,
      })
      .select()
      .single();

    if (dbError) {
      // Clean up uploaded file if database insert fails
      await supabase.storage.from(STORAGE_BUCKET).remove([filePath]);
      console.error('Database error:', dbError);
      throw new Error(dbError.message || 'Failed to create attachment record');
    }

    return {
      ...attachment,
      file_url: fileUrl,
    };
  } catch (error) {
    console.error('Error uploading attachment:', error);
    throw error;
  }
}

/**
 * Get all attachments for a task
 * @param {number} taskId - Task ID
 * @returns {Promise<Array>} - Array of attachments with public URLs
 */
export async function getAttachments(taskId) {
  try {
    const { data: attachments, error } = await supabase
      .from('attachments')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching attachments:', error);
      throw new Error(error.message || 'Failed to fetch attachments');
    }

    // Add public URLs to each attachment
    const attachmentsWithUrls = attachments.map((attachment) => {
      const { data: urlData } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(attachment.file_path);

      return {
        ...attachment,
        file_url: urlData.publicUrl,
      };
    });

    return attachmentsWithUrls;
  } catch (error) {
    console.error('Error getting attachments:', error);
    throw error;
  }
}

/**
 * Delete an attachment
 * @param {number} attachmentId - Attachment ID
 * @returns {Promise<void>}
 */
export async function deleteAttachment(attachmentId) {
  try {
    // Get attachment details first
    const { data: attachment, error: fetchError } = await supabase
      .from('attachments')
      .select('*')
      .eq('id', attachmentId)
      .single();

    if (fetchError) {
      console.error('Error fetching attachment:', fetchError);
      throw new Error(fetchError.message || 'Failed to fetch attachment');
    }

    if (!attachment) {
      throw new Error('Attachment not found');
    }

    // Verify user can delete (must be uploader or admin)
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const isUploader = attachment.uploaded_by === user.id;
    const isAdmin = user.user_metadata?.role === 'admin' || user.user_metadata?.role === 'sys_admin';

    if (!isUploader && !isAdmin) {
      throw new Error('You do not have permission to delete this attachment');
    }

    // Delete file from storage
    const { error: storageError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([attachment.file_path]);

    if (storageError) {
      console.error('Storage deletion error:', storageError);
      // Continue even if storage deletion fails
    }

    // Delete database record
    const { error: deleteError } = await supabase
      .from('attachments')
      .delete()
      .eq('id', attachmentId);

    if (deleteError) {
      console.error('Database deletion error:', deleteError);
      throw new Error(deleteError.message || 'Failed to delete attachment');
    }

    return;
  } catch (error) {
    console.error('Error deleting attachment:', error);
    throw error;
  }
}

/**
 * Download an attachment
 * @param {Object} attachment - Attachment object
 */
export function downloadAttachment(attachment) {
  try {
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(attachment.file_path);

    // Create a temporary anchor element to trigger download
    const link = document.createElement('a');
    link.href = urlData.publicUrl;
    link.download = attachment.file_name;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('Error downloading attachment:', error);
    throw error;
  }
}
