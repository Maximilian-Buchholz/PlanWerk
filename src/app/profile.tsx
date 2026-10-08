import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

import { ProfileScreen } from '@/components/profile-screen';
import { getCurrentProfile, getCurrentUserEmail, signOut, updateProfileStatus } from '@/lib/auth';
import { getErrorMessage } from '@/lib/errors';
import type { Profile } from '@/types/tasks';

export default function ProfileRoute() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [profileResult, emailResult] = await Promise.all([
        getCurrentProfile(),
        getCurrentUserEmail(),
      ]);
      setLoadError(null);
      setProfile(profileResult);
      setEmail(emailResult);
    } catch (error) {
      console.error("Profil konnte nicht geladen werden:", error);
      setLoadError(getErrorMessage(error, "Profil konnte nicht geladen werden."));
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <ProfileScreen
      profile={profile}
      email={email}
      loadError={loadError}
      onBack={() => router.back()}
      onEditProfile={() => {
        // TODO: Navigation zu Profil-Bearbeiten-Screen (Name ändern →
        //       profiles.full_name per supabase.from('profiles').update(...),
        //       E-Mail/Passwort ändern über supabase.auth.updateUser(...)).
        //       Screen existiert noch nicht.
      }}
      onPressTeamManagement={() => {
        // TODO: Navigation zu Teamverwaltung-Screen. Datenbasis:
        //       public.project_members (+ public.projects für Projektnamen).
        //       Dort je nach UX: Liste aller Projekte mit Mitgliedern, Rollen
        //       (role: 'owner' | 'member') verwalten/einladen. Screen
        //       existiert noch nicht.
      }}
      onChangeStatus={async (status) => {
        if (!profile) return;
        try {
          await updateProfileStatus(profile.id, status);
          setProfile({ ...profile, ...status });
        } catch (error) {
          console.error("Status konnte nicht gespeichert werden:", error);
          setLoadError(getErrorMessage(error, "Status konnte nicht gespeichert werden."));
          load();
        }
      }}
      onSignOut={async () => {
        await signOut();
        router.replace('/');
      }}
    />
  );
}
