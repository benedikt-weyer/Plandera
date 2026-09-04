'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useError } from '@/utils/context/ErrorContext';
import { useTranslation } from '@/utils/context/LanguageContext';
import { importUserData, importDecryptedUserData, type ExportedData, type DecryptedExportData } from '@/app/settings/api';
import { decryptData, deriveKeyFromPassword } from '@/utils/cryptography/encryption';
import { Upload, Eye, AlertTriangle, CheckCircle, Lock, Unlock, FileText } from 'lucide-react';
// Remove unused import

interface ImportSectionProps {
  encryptionKey: string;
}

interface ImportPreview {
  isValid: boolean;
  data?: ExportedData | DecryptedExportData;
  summary: string;
  warnings: string[];
  errors: string[];
  isDecrypted: boolean;
}

export function ImportSection({ encryptionKey }: ImportSectionProps) {
  const [isImporting, setIsImporting] = useState(false);
  const [isDryRun, setIsDryRun] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [importData, setImportData] = useState<string>('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [isPasswordProtected, setIsPasswordProtected] = useState(false);
  const [isDecryptedFormat, setIsDecryptedFormat] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { setError } = useError();
  const { t } = useTranslation();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImportFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setImportData(content);
        // Try to detect the format
        try {
          const parsed = JSON.parse(content);
          const isPasswordProtected = parsed.encrypted_data && parsed.salt && parsed.iv;
          let isDecrypted = false;
          
          if (isPasswordProtected) {
            // For password protected data, check if it was originally decrypted format
            isDecrypted = parsed.original_format === 'decrypted';
          } else {
            // For non-password protected data, check if it's decrypted format
            isDecrypted = parsed.data && parsed.data.tasks && 
              Array.isArray(parsed.data.tasks) && parsed.data.tasks.length > 0 && 
              typeof parsed.data.tasks[0].content === 'string'; // Decrypted tasks have direct content field
          }
          
          setIsPasswordProtected(isPasswordProtected);
          setIsDecryptedFormat(isDecrypted);
        } catch {
          setIsPasswordProtected(false);
          setIsDecryptedFormat(false);
        }
      };
      reader.readAsText(file);
    }
  };

  const decryptImportData = (rawData: string, password?: string): ExportedData | DecryptedExportData | null => {
    try {
      const parsed = JSON.parse(rawData);
      
      // Check if it's password protected
      if (parsed.encrypted_data && parsed.salt && parsed.iv) {
        if (!password) {
          throw new Error('Password required for encrypted data');
        }
        
        const derivedKey = deriveKeyFromPassword(password, parsed.salt);
        const decrypted = decryptData(parsed.encrypted_data, derivedKey, parsed.iv);
        
        if (!decrypted) {
          throw new Error('Failed to decrypt data - check password');
        }
        
        // Check if this was originally a decrypted format that was password protected
        if (parsed.original_format === 'decrypted') {
          return decrypted as DecryptedExportData;
        } else {
          return decrypted as ExportedData;
        }
      } else {
        // Plain JSON format
        return parsed as ExportedData;
      }
    } catch (error) {
      console.error('Failed to decrypt import data:', error);
      return null;
    }
  };

  const parseDecryptedData = (rawData: string): DecryptedExportData | null => {
    try {
      const parsed = JSON.parse(rawData);
      
      // Validate it's a decrypted format
      if (parsed.data && parsed.data.tasks && Array.isArray(parsed.data.tasks) && 
          parsed.data.tasks.length > 0 && typeof parsed.data.tasks[0].content === 'string') {
        return parsed as DecryptedExportData;
      }
      
      return null;
    } catch (error) {
      console.error('Failed to parse decrypted data:', error);
      return null;
    }
  };

  const validateImportData = (data: ExportedData | DecryptedExportData, isDecrypted: boolean): ImportPreview => {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Basic structure validation
    if (!data.version) {
      errors.push('Missing version information');
    }
    if (!data.data) {
      errors.push('Invalid data structure');
      return {
        isValid: false,
        summary: 'Invalid import file structure',
        warnings,
        errors,
        isDecrypted
      };
    }

    // Data validation - handle both encrypted and decrypted formats
    let tasks, projects, calendars, calendarEvents;
    
    if (isDecrypted) {
      // DecryptedExportData format
      ({ tasks, projects, calendars, calendarEvents } = (data.data as any));
    } else {
      // ExportedData format
      const exportData = data.data as any;
      tasks = exportData.can_do_list;
      projects = exportData.projects;
      calendars = exportData.calendars;
      calendarEvents = exportData.calendar_events;
    }
    
    if (!Array.isArray(tasks)) errors.push('Invalid tasks data - must be an array');
    if (!Array.isArray(projects)) errors.push('Invalid projects data - must be an array');
    if (!Array.isArray(calendars)) errors.push('Invalid calendars data - must be an array');
    if (!Array.isArray(calendarEvents)) errors.push('Invalid calendar events data - must be an array');

    // Version compatibility
    if (data.version !== '1.0.0') {
      warnings.push(`Version mismatch: importing ${data.version}, current version is 1.0.0`);
    }

    // Data size warnings
    const totalItems = (tasks?.length || 0) + (projects?.length || 0) + (calendars?.length || 0) + (calendarEvents?.length || 0);
    if (totalItems > 1000) {
      warnings.push(`Large import detected (${totalItems} items) - this may take a while`);
    }

    // Check for potential conflicts and data issues
    if (tasks && tasks.length > 0) {
      warnings.push(`Processing ${tasks.length} tasks - duplicates will be automatically skipped`);
      
      if (isDecrypted) {
        // Check if decrypted tasks have required fields
        const invalidTasks = tasks.filter((task: any) => !task.content);
        if (invalidTasks.length > 0) {
          errors.push(`${invalidTasks.length} tasks are missing required content field`);
        }
      } else {
        // Check if encrypted tasks have required fields
        const invalidTasks = tasks.filter((task: any) => !task.encrypted_data || !task.iv || !task.salt);
        if (invalidTasks.length > 0) {
          errors.push(`${invalidTasks.length} tasks are missing required encryption fields`);
        }
      }
      
      // Check for tasks with project references
      const tasksWithProjects = tasks.filter((task: any) => isDecrypted ? task.projectId : task.project_id);
      if (tasksWithProjects.length > 0) {
        warnings.push(`${tasksWithProjects.length} tasks reference projects - these relationships will be preserved if projects are also imported`);
      }
    }
    
    if (projects && projects.length > 0) {
      warnings.push(`Processing ${projects.length} projects - duplicates will be automatically skipped`);
      
      if (isDecrypted) {
        // Check if decrypted projects have required fields
        const invalidProjects = projects.filter((project: any) => !project.name);
        if (invalidProjects.length > 0) {
          errors.push(`${invalidProjects.length} projects are missing required name field`);
        }
      } else {
        // Check if encrypted projects have required fields
        const invalidProjects = projects.filter((project: any) => !project.encrypted_data || !project.iv || !project.salt);
        if (invalidProjects.length > 0) {
          errors.push(`${invalidProjects.length} projects are missing required encryption fields`);
        }
      }
      
      // Check for nested projects
      const nestedProjects = projects.filter((project: any) => isDecrypted ? project.parentId : project.parent_id);
      if (nestedProjects.length > 0) {
        warnings.push(`${nestedProjects.length} projects have parent relationships - these relationships will be preserved`);
      }
    }

    if (calendars && calendars.length > 0) {
      warnings.push(`Processing ${calendars.length} calendars - duplicates will be automatically skipped`);
      
      if (isDecrypted) {
        // Check if decrypted calendars have required fields
        const invalidCalendars = calendars.filter((calendar: any) => !calendar.name);
        if (invalidCalendars.length > 0) {
          errors.push(`${invalidCalendars.length} calendars are missing required name field`);
        }
      } else {
        // Check if encrypted calendars have required fields
        const invalidCalendars = calendars.filter((calendar: any) => !calendar.encrypted_data || !calendar.iv || !calendar.salt);
        if (invalidCalendars.length > 0) {
          errors.push(`${invalidCalendars.length} calendars are missing required encryption fields`);
        }
      }
    }

    if (calendarEvents && calendarEvents.length > 0) {
      warnings.push(`Processing ${calendarEvents.length} calendar events - duplicates will be automatically skipped`);
      
      if (isDecrypted) {
        // Check if decrypted events have required fields
        const invalidEvents = calendarEvents.filter((event: any) => !event.title);
        if (invalidEvents.length > 0) {
          errors.push(`${invalidEvents.length} calendar events are missing required title field`);
        }
      } else {
        // Check if encrypted events have required fields
        const invalidEvents = calendarEvents.filter((event: any) => !event.encrypted_data || !event.iv || !event.salt);
        if (invalidEvents.length > 0) {
          errors.push(`${invalidEvents.length} calendar events are missing required encryption fields`);
        }
      }
    }

    if (totalItems === 0) {
      warnings.push('No data to import - the export appears to be empty');
    }

    const summary = `${tasks?.length || 0} tasks, ${projects?.length || 0} projects, ${calendars?.length || 0} calendars, ${calendarEvents?.length || 0} events`;

    return {
      isValid: errors.length === 0,
      data,
      summary,
      warnings,
      errors,
      isDecrypted
    };
  };

  const handleDryRun = async () => {
    if (!importData) {
      setError(t('settings.pleaseSelectFile'));
      return;
    }

    if (isPasswordProtected && !password) {
      setError(t('settings.pleaseEnterDecryptionPassword'));
      return;
    }

    setIsDryRun(true);
    try {
      let parsedData: ExportedData | DecryptedExportData | null = null;
      let isDecrypted = false;

      if (isPasswordProtected) {
        // Handle password-protected data (could be originally encrypted or decrypted)
        parsedData = decryptImportData(importData, password);
        if (parsedData) {
          // Check if the decrypted data is in decrypted format
          const dataObj = parsedData.data as any;
          // Check for decrypted format (has 'tasks' field with string content)
          if (dataObj.tasks && Array.isArray(dataObj.tasks) && 
              dataObj.tasks.length > 0 && typeof dataObj.tasks[0].content === 'string') {
            isDecrypted = true;
          }
          // Check for encrypted format (has 'can_do_list' field with encrypted content)
          else if (dataObj.can_do_list && Array.isArray(dataObj.can_do_list) && 
                   dataObj.can_do_list.length > 0 && typeof dataObj.can_do_list[0].content === 'string' &&
                   dataObj.can_do_list[0].content.includes('encrypted:')) {
            isDecrypted = false;
          } else {
            isDecrypted = false; // Default to encrypted format
          }
        }
      } else if (isDecryptedFormat) {
        // Handle plain decrypted data
        parsedData = parseDecryptedData(importData);
        isDecrypted = true;
      } else {
        // Handle plain encrypted data
        parsedData = decryptImportData(importData);
        isDecrypted = false;
      }

      if (!parsedData) {
        setError(t('settings.failedToAnalyze'));
        return;
      }

      const preview = validateImportData(parsedData, isDecrypted);
      setPreview(preview);
    } catch (error) {
      console.error('Dry run failed:', error);
      setError(t('settings.failedToAnalyze'));
    } finally {
      setIsDryRun(false);
    }
  };

  const handleImport = async () => {
    if (!preview?.isValid || !preview.data) {
      setError(t('settings.pleaseDryRunFirst'));
      return;
    }

    setIsImporting(true);
    try {
      console.log('Starting import process...');
      
      if (preview.isDecrypted) {
        await importDecryptedUserData(preview.data as DecryptedExportData, encryptionKey);
      } else {
        await importUserData(preview.data as ExportedData, encryptionKey);
      }
      
      setError(''); // Clear any previous errors
      
      // Success feedback with more detail
      const formatType = preview.isDecrypted ? 'decrypted' : 'encrypted';
      const dataObj = preview.data.data as any;
      const tasksCount = dataObj.tasks ? dataObj.tasks.length : (dataObj.can_do_list ? dataObj.can_do_list.length : 0);
      const calendarEventsCount = dataObj.calendarEvents ? dataObj.calendarEvents.length : (dataObj.calendar_events ? dataObj.calendar_events.length : 0);
      const summary = t('settings.processedForImport', {
        format: formatType,
        summary: `${tasksCount} tasks, ${dataObj.projects.length} projects, ${dataObj.calendars.length} calendars, ${calendarEventsCount} events`
      });
      
      alert(t('settings.importCompleted', { summary }));
      
      // Reset form
      setImportData('');
      setImportFile(null);
      setPassword('');
      setPreview(null);
      setIsDecryptedFormat(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Import failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(t('settings.importFailed', { error: errorMessage }));
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">{t('settings.importYourData')}</h2>
        <p className="text-sm text-muted-foreground">
          {t('settings.importDesc')}
        </p>
      </div>

      {/* File Upload */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="import-file">{t('settings.importFile')}</Label>
          <div className="flex gap-2">
            <Input
              ref={fileInputRef}
              id="import-file"
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className="flex-1"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              {t('settings.chooseFile')}
            </Button>
          </div>
          {importFile && (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                {t('settings.selectedFile', { 
                  filename: importFile.name, 
                  size: (importFile.size / 1024).toFixed(1) 
                })}
              </p>
              {(isPasswordProtected || isDecryptedFormat) && (
                <div className="flex items-center gap-2 text-xs">
                  {isPasswordProtected ? (
                    <>
                      <Lock className="h-3 w-3" />
                      <span className="text-amber-600">
                        {t('settings.passwordProtectedDetected')} {isDecryptedFormat ? t('settings.originallyDecrypted') : t('settings.originallyEncrypted')}
                      </span>
                    </>
                  ) : isDecryptedFormat ? (
                    <>
                      <FileText className="h-3 w-3" />
                      <span className="text-blue-600">{t('settings.decryptedFormatDetected')}</span>
                    </>
                  ) : (
                    <>
                      <Unlock className="h-3 w-3" />
                      <span className="text-gray-600">{t('settings.plainJsonEncrypted')}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Password Input for Encrypted Files */}
        {isPasswordProtected && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              <Label htmlFor="import-password">{t('settings.decryptionPassword')}</Label>
            </div>
            <Input
              id="import-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('settings.enterDecryptionPassword')}
            />
          </div>
        )}

        {/* Manual Data Input */}
        <div className="space-y-2">
          <Label htmlFor="import-data">{t('settings.orPasteJson')}</Label>
          <Textarea
            id="import-data"
            value={importData}
            onChange={(e) => {
              setImportData(e.target.value);
              // Re-detect format when data changes
              try {
                const parsed = JSON.parse(e.target.value);
                const isPasswordProtected = parsed.encrypted_data && parsed.salt && parsed.iv;
                let isDecrypted = false;
                
                if (isPasswordProtected) {
                  // For password protected data, check if it was originally decrypted format
                  isDecrypted = parsed.original_format === 'decrypted';
                } else {
                  // For non-password protected data, check if it's decrypted format
                  isDecrypted = parsed.data && parsed.data.tasks && 
                    Array.isArray(parsed.data.tasks) && parsed.data.tasks.length > 0 && 
                    typeof parsed.data.tasks[0].content === 'string';
                }
                
                setIsPasswordProtected(isPasswordProtected);
                setIsDecryptedFormat(isDecrypted);
              } catch {
                setIsPasswordProtected(false);
                setIsDecryptedFormat(false);
              }
            }}
            placeholder={t('settings.pasteExportedJson')}
            className="h-32 text-xs font-mono"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          onClick={handleDryRun}
          disabled={isDryRun || !importData}
          variant="outline"
          className="flex-1"
        >
          <Eye className="h-4 w-4 mr-2" />
          {isDryRun ? t('settings.analyzing') : t('settings.dryRunPreview')}
        </Button>
        <Button
          onClick={handleImport}
          disabled={isImporting || !preview?.isValid}
          className="flex-1"
        >
          <Upload className="h-4 w-4 mr-2" />
          {isImporting ? t('settings.importing') : t('settings.importDataButton')}
        </Button>
      </div>

      {/* Preview Results */}
      {preview && (
        <div className="border rounded-lg p-4 space-y-4">
          <div className="flex items-center gap-2">
            {preview.isValid ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-red-600" />
            )}
            <h3 className="font-medium">
              {preview.isValid ? t('settings.importPreview') : t('settings.validationFailed')}
            </h3>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{t('settings.dataSummary')}</span>
              <span>{preview.summary}</span>
            </div>
            {preview.data && (
              <>
                <div className="flex justify-between text-sm">
                  <span>{t('settings.exportDate')}</span>
                  <span>{new Date(preview.data.timestamp).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>{t('settings.exportVersion')}</span>
                  <span>{preview.data.version}</span>
                </div>
              </>
            )}
            <div className="flex justify-between text-sm">
              <span>{t('settings.format')}</span>
              <span className="flex items-center gap-1">
                {isPasswordProtected ? (
                  <>
                    <Lock className="h-3 w-3" />
                    {t('settings.passwordProtected')}
                  </>
                ) : preview.isDecrypted ? (
                  <>
                    <FileText className="h-3 w-3" />
                    {t('settings.decrypted')}
                  </>
                ) : (
                  <>
                    <Unlock className="h-3 w-3" />
                    {t('settings.plainJsonEncrypted')}
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Warnings */}
          {preview.warnings.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-amber-600">{t('settings.warnings')}</h4>
              <ul className="text-sm text-amber-700 space-y-1">
                {preview.warnings.map((warning, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Errors */}
          {preview.errors.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-red-600">{t('settings.errors')}</h4>
              <ul className="text-sm text-red-700 space-y-1">
                {preview.errors.map((error, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    {error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 