'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useError } from '@/utils/context/ErrorContext';
import { useTranslation } from '@/utils/context/LanguageContext';
import { clearAllUserData } from '@/app/settings/api';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Trash2, AlertTriangle } from 'lucide-react';

export function DeleteSection() {
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { setError } = useError();
  const { t } = useTranslation();

  const REQUIRED_CONFIRMATION = t('settings.confirmationRequired');

  const handleDeleteAll = async () => {
    if (confirmationText !== REQUIRED_CONFIRMATION) {
      setError(t('settings.pleaseTypeConfirmation'));
      return;
    }

    setIsDeleting(true);
    try {
      await clearAllUserData();
      setError(''); // Clear any previous errors
      
      // Success feedback
      alert(t('settings.dataDeletedSuccess'));
      
      // Redirect to dashboard after successful deletion
      window.location.href = '/';
    } catch (error) {
      console.error('Delete failed:', error);
      setError(t('settings.failedToDelete'));
    } finally {
      setIsDeleting(false);
      setIsDialogOpen(false);
      setConfirmationText('');
    }
  };

  const isConfirmationValid = confirmationText === REQUIRED_CONFIRMATION;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2 text-red-600">{t('settings.dangerZone')}</h2>
        <p className="text-sm text-muted-foreground">
          {t('settings.dangerZoneDesc')}
        </p>
      </div>

      <div className="border border-red-200 rounded-lg p-6 space-y-4 bg-red-50">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-2">
            <h3 className="font-medium text-red-900">{t('settings.deleteAllData')}</h3>
            <p className="text-sm text-red-700">
              {t('settings.deleteAllDataDesc')}:
            </p>
            <ul className="text-sm text-red-700 space-y-1 ml-4">
              <li>• {t('settings.deleteAllTasks')}</li>
              <li>• {t('settings.deleteAllProjects')}</li>
              <li>• {t('settings.deleteAllCalendars')}</li>
              <li>• {t('settings.deleteAllProfile')}</li>
              <li>• {t('settings.deleteAllSettings')}</li>
            </ul>
            <p className="text-sm text-red-700 font-medium">
              {t('settings.deleteIrreversible')}
            </p>
          </div>
        </div>

        <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="w-full">
              <Trash2 className="h-4 w-4 mr-2" />
              {t('settings.deleteAllMyData')}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                {t('settings.confirmDataDeletion')}
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-4">
                <p>
                  {t('settings.confirmDeletionMessage')}
                </p>
                <p className="font-medium text-red-600">
                  {t('settings.cannotBeUndone')}
                </p>
                <div className="space-y-2">
                  <Label htmlFor="delete-confirmation" className="text-sm font-medium">
                    {t('settings.typeToConfirm', { text: REQUIRED_CONFIRMATION })}
                  </Label>
                  <Input
                    id="delete-confirmation"
                    value={confirmationText}
                    onChange={(e) => setConfirmationText(e.target.value)}
                    placeholder={REQUIRED_CONFIRMATION}
                    className="font-mono"
                  />
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setConfirmationText('')}>
                {t('common.cancel')}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteAll}
                disabled={!isConfirmationValid || isDeleting}
                className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              >
                {isDeleting ? t('settings.deleting') : t('settings.deleteAllData')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Additional warnings */}
      <div className="space-y-3 text-sm text-muted-foreground">
        <div className="flex items-start gap-2">
          <span className="text-blue-600">💡</span>
          <p>
            {t('settings.deleteTip')}
          </p>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-amber-600">⚠️</span>
          <p>
            {t('settings.deleteNote')}
          </p>
        </div>
      </div>
    </div>
  );
} 