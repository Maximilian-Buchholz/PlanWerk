import { useRouter } from 'expo-router';

import { CreateProjectScreen } from '@/components/create-project-screen';
import { getCurrentUserId } from '@/lib/auth';
import { createProject } from '@/lib/tasks';

export default function NewProjectRoute() {
  const router = useRouter();

  return (
    <CreateProjectScreen
      onBack={() => router.back()}
      onSubmit={async ({ name, dueDate }) => {
        const userId = await getCurrentUserId();
        if (!userId) return;
        await createProject({ userId, name, dueDate });
        router.back();
      }}
    />
  );
}
