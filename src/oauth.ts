import { InstallProvider } from '@slack/oauth';
import { Config } from './types';

export function createInstallProvider(config: Config) {
  return new InstallProvider({
    clientId: config.slack.clientId,
    clientSecret: config.slack.clientSecret,
    stateSecret: config.slack.stateSecret,
    installationStore: {
      storeInstallation: async (installation) => {
        // TODO: Store in database
        // For now, we'll store in memory (not production ready)
        if (installation.isEnterpriseInstall && installation.enterprise !== undefined) {
          // Enterprise installation
          return await saveInstallation(installation.enterprise.id, installation);
        }
        if (installation.team !== undefined) {
          // Single team installation
          return await saveInstallation(installation.team.id, installation);
        }
        throw new Error('Failed to save installation');
      },
      fetchInstallation: async (installQuery) => {
        // TODO: Fetch from database
        if (installQuery.isEnterpriseInstall && installQuery.enterpriseId !== undefined) {
          return await getInstallation(installQuery.enterpriseId);
        }
        if (installQuery.teamId !== undefined) {
          return await getInstallation(installQuery.teamId);
        }
        throw new Error('Failed to fetch installation');
      },
    },
  });
}

// Temporary in-memory store (replace with database)
const installations = new Map<string, any>();

async function saveInstallation(id: string, installation: any) {
  installations.set(id, installation);
}

async function getInstallation(id: string) {
  return installations.get(id);
}