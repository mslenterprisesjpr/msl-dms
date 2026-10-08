import { useQuery } from "@tanstack/react-query";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import {
	type AdminStats,
	dashboardService,
	type WorkerStats,
} from "@/services/dashboard.service";

export const dashboardKeys = {
	all: ["dashboard"] as const,
	admin: (orgId: string | null) =>
		[...dashboardKeys.all, "admin", orgId] as const,
	worker: (orgId: string | null, workerId?: string) =>
		[...dashboardKeys.all, "worker", orgId, workerId] as const,
};

export function useAdminStats(options?: { enabled?: boolean }) {
	const currentOrgId = useOrganizationStore((state) => state.currentOrgId);

	return useQuery({
		queryKey: dashboardKeys.admin(currentOrgId),
		queryFn: () => dashboardService.getAdminStats(),
		enabled: options?.enabled !== false && !!currentOrgId,
	});
}

export function useWorkerStats(
	workerId?: string,
	options?: { enabled?: boolean },
) {
	const currentOrgId = useOrganizationStore((state) => state.currentOrgId);

	return useQuery({
		queryKey: dashboardKeys.worker(currentOrgId, workerId),
		queryFn: () => dashboardService.getWorkerStats(workerId),
		enabled: options?.enabled !== false && !!currentOrgId,
	});
}

export type { AdminStats, WorkerStats };
