import { ProjectService } from '@/services/projects/project-service';

function makeService(deleteResult: { error: string | null } = { error: null }) {
  const del = jest.fn().mockResolvedValue(deleteResult);
  const backend: any = { projects: { delete: del } };
  return { service: new ProjectService(backend), del };
}

describe('ProjectService.deleteProject', () => {
  let consoleError: jest.SpyInstance;
  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => consoleError.mockRestore());

  it('deletes a single project without the recursive option by default', async () => {
    const { service, del } = makeService();
    await service.deleteProject('p1');
    expect(del).toHaveBeenCalledWith('p1', undefined);
  });

  it('passes the recursive option on to the backend in one call', async () => {
    const { service, del } = makeService();
    await service.deleteProject('p1', { recursive: true });
    expect(del).toHaveBeenCalledTimes(1);
    expect(del).toHaveBeenCalledWith('p1', { recursive: true });
  });

  it('fails when the backend reports an error instead of treating it as deleted', async () => {
    const { service } = makeService({ error: 'Project not found' });
    await expect(service.deleteProject('p1', { recursive: true })).rejects.toThrow('Failed to delete project');
  });
});
