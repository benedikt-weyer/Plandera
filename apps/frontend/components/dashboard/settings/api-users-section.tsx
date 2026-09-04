'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useError } from '@/utils/context/ErrorContext';
import {
  createApiUser,
  deleteApiUser,
  listApiUsers,
  provisionApiUserAccess,
  type ApiUserWithLabel,
} from '@/app/settings/api-users-api';
import { KeyRound, Trash2, ShieldCheck, Copy } from 'lucide-react';

export function ApiUsersSection() {
  const [apiUsers, setApiUsers] = useState<ApiUserWithLabel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newLabel, setNewLabel] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { setError } = useError();

  const refresh = async () => {
    setIsLoading(true);
    try {
      setApiUsers(await listApiUsers());
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load api users');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async () => {
    if (!newLabel.trim()) {
      setError('Enter a label for the new api user.');
      return;
    }
    setIsCreating(true);
    try {
      const { tokenHex } = await createApiUser(newLabel.trim());
      setNewToken(tokenHex);
      setNewLabel('');
      await refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create api user');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this api user? Anything only it could decrypt becomes unrecoverable.')) {
      return;
    }
    setBusyId(id);
    try {
      await deleteApiUser(id);
      await refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to delete api user');
    } finally {
      setBusyId(null);
    }
  };

  const handleProvision = async (apiUser: ApiUserWithLabel) => {
    setBusyId(apiUser.id);
    try {
      const { provisioned } = await provisionApiUserAccess(apiUser);
      alert(`Granted access to ${provisioned} record(s).`);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to grant access');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">API Users</h2>
        <p className="text-sm text-muted-foreground">
          Scoped-access credentials for scripts and integrations. Each api user has its own
          login token and can only decrypt the records you explicitly grant it access to — never
          your account password.
        </p>
      </div>

      <div className="border rounded-lg p-4 space-y-3">
        <h3 className="font-medium">Create a new api user</h3>
        <div className="flex gap-2">
          <div className="flex-1 space-y-1">
            <Label htmlFor="api-user-label">Label</Label>
            <Input
              id="api-user-label"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g. CI export script"
            />
          </div>
          <Button onClick={handleCreate} disabled={isCreating} className="self-end">
            <KeyRound className="h-4 w-4 mr-2" />
            {isCreating ? 'Creating...' : 'Create'}
          </Button>
        </div>

        {newToken && (
          <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 space-y-2">
            <p className="text-sm font-medium">
              Copy this token now — it is shown only once and cannot be recovered later:
            </p>
            <div className="flex gap-2">
              <Input value={newToken} readOnly className="font-mono text-xs" />
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigator.clipboard.writeText(newToken)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="border rounded-lg p-4 space-y-3">
        <h3 className="font-medium">Existing api users</h3>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : apiUsers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No api users yet.</p>
        ) : (
          <ul className="divide-y">
            {apiUsers.map((apiUser) => (
              <li key={apiUser.id} className="flex items-center justify-between py-3 gap-3">
                <div>
                  <p className="font-medium">{apiUser.label}</p>
                  <p className="text-xs text-muted-foreground">{apiUser.username}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busyId === apiUser.id}
                    onClick={() => handleProvision(apiUser)}
                    title="Grant access to every record you currently have"
                  >
                    <ShieldCheck className="h-4 w-4 mr-2" />
                    Grant access to all data
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busyId === apiUser.id}
                    onClick={() => handleDelete(apiUser.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
