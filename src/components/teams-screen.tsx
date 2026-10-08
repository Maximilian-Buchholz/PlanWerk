import { DMMono_400Regular, DMMono_500Medium } from "@expo-google-fonts/dm-mono";
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
} from "@expo-google-fonts/dm-sans";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/avatar";
import { AvatarStack } from "@/components/avatar-stack";
import { Spacing } from "@/constants/theme";
import type { Team } from "@/lib/teams";
import { Icon } from "@/components/icons";
import { colors } from "@/theme/colors";
import type { Profile } from "@/types/tasks";

SplashScreen.preventAutoHideAsync().catch(() => {});

type SheetKind = "friend" | "team" | null;

export type TeamsScreenProps = {
  currentUser?: Profile;
  friends: Profile[];
  /** Ids of users currently online, for the presence dot on friend avatars. */
  onlineUserIds?: ReadonlySet<string>;
  pendingSentRequests: Profile[];
  teams: Team[];
  /** Set when friends/requests failed to load from Supabase. */
  loadError?: string | null;
  refreshing?: boolean;
  onRefresh?: () => void;
  onBack?: () => void;
  onSearchByEmail: (email: string) => Promise<Profile | null>;
  onSendRequest: (profile: Profile) => Promise<void> | void;
  onMessageFriend?: (friend: Profile) => void;
  onCreateTeam?: (input: { name: string; memberIds: string[] }) => Promise<void> | void;
  onDeleteTeam?: (teamId: string) => Promise<void> | void;
  onRemoveFriend?: (friend: Profile) => Promise<void> | void;
  onPressAvatar?: () => void;
};

export function TeamsScreen({
  currentUser,
  friends,
  onlineUserIds,
  pendingSentRequests,
  teams,
  loadError,
  refreshing,
  onRefresh,
  onBack,
  onSearchByEmail,
  onSendRequest,
  onMessageFriend,
  onCreateTeam,
  onDeleteTeam,
  onRemoveFriend,
  onPressAvatar,
}: TeamsScreenProps) {
  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMMono_400Regular,
    DMMono_500Medium,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  const [email, setEmail] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [foundProfile, setFoundProfile] = useState<Profile | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const [teamName, setTeamName] = useState("");
  const [teamMemberIds, setTeamMemberIds] = useState<string[]>([]);
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);

  const [activeSheet, setActiveSheet] = useState<SheetKind>(null);
  const [renderedSheet, setRenderedSheet] = useState<SheetKind>(null);
  const [isModalMounted, setIsModalMounted] = useState(false);
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(320)).current;

  useEffect(() => {
    if (activeSheet) {
      setRenderedSheet(activeSheet);
      setIsModalMounted(true);
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(sheetTranslateY, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    } else if (isModalMounted) {
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(sheetTranslateY, { toValue: 320, duration: 180, useNativeDriver: true }),
      ]).start(() => {
        setIsModalMounted(false);
        setRenderedSheet(null);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSheet]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  function closeSheet() {
    setActiveSheet(null);
  }

  function toggleTeamMember(friendId: string) {
    setTeamMemberIds((current) =>
      current.includes(friendId) ? current.filter((id) => id !== friendId) : [...current, friendId],
    );
  }

  async function handleCreateTeam() {
    const trimmed = teamName.trim();
    if (!trimmed || teamMemberIds.length === 0 || isCreatingTeam) return;
    setIsCreatingTeam(true);
    setTeamError(null);
    try {
      await onCreateTeam?.({ name: trimmed, memberIds: teamMemberIds });
      setTeamName("");
      setTeamMemberIds([]);
      closeSheet();
    } catch (error) {
      setTeamError(error instanceof Error ? error.message : "Team konnte nicht erstellt werden.");
    } finally {
      setIsCreatingTeam(false);
    }
  }

  function handleDeleteTeam(team: Team) {
    Alert.alert("Team löschen?", `„${team.name}“ wird entfernt.`, [
      { text: "Abbrechen", style: "cancel" },
      { text: "Löschen", style: "destructive", onPress: () => onDeleteTeam?.(team.id) },
    ]);
  }

  const friendSwipeRefs = useRef<Record<string, Swipeable | null>>({});

  function handleRemoveFriend(friend: Profile) {
    Alert.alert("Freund entfernen?", `${friend.full_name ?? "Dieser Nutzer"} wird aus deiner Freundesliste entfernt.`, [
      { text: "Abbrechen", style: "cancel" },
      { text: "Entfernen", style: "destructive", onPress: () => onRemoveFriend?.(friend) },
    ]);
  }

  const alreadyFriendIds = new Set([
    ...friends.map((friend) => friend.id),
    ...pendingSentRequests.map((friend) => friend.id),
  ]);

  const ownedTeams = teams.filter((team) => team.ownerId === currentUser?.id);
  const memberTeams = teams.filter((team) => team.ownerId !== currentUser?.id);

  async function handleSearch() {
    const trimmed = email.trim();
    if (!trimmed || isSearching) return;
    setIsSearching(true);
    setSearchError(null);
    setFoundProfile(null);
    setSentTo(null);
    try {
      const result = await onSearchByEmail(trimmed);
      if (!result) {
        setSearchError("Kein Nutzer mit dieser E-Mail gefunden.");
      } else if (result.id === currentUser?.id) {
        setSearchError("Das bist du selbst.");
      } else {
        setFoundProfile(result);
      }
    } catch (error) {
      setSearchError(
        error instanceof Error ? error.message : "Suche fehlgeschlagen. Bitte versuche es erneut.",
      );
    } finally {
      setIsSearching(false);
    }
  }

  async function handleSendRequest() {
    if (!foundProfile || isSending) return;
    setIsSending(true);
    try {
      await onSendRequest(foundProfile);
      setSentTo(foundProfile.id);
    } catch (error) {
      setSearchError(
        error instanceof Error ? error.message : "Anfrage konnte nicht gesendet werden.",
      );
    } finally {
      setIsSending(false);
    }
  }

  const alreadyConnected = foundProfile ? alreadyFriendIds.has(foundProfile.id) : false;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <Pressable
            onPress={onBack}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Zurück"
            style={styles.backButton}
          >
            <Text style={styles.backButtonIcon}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Teams</Text>
          <View style={styles.headerSpacer} />
          <Pressable
            onPress={onPressAvatar}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Zum Profil"
          >
            <Avatar name={currentUser?.full_name ?? null} color="#000000" shape="square" size={40} />
          </Pressable>
        </View>
        <View style={styles.headerDivider} />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing ?? false} onRefresh={onRefresh} tintColor={colors.brandOrange} />
          }
        >
          {loadError && (
            <Text style={styles.errorText} accessibilityRole="alert">
              {loadError}
            </Text>
          )}

          <View style={styles.actionRow}>
            <Pressable
              onPress={() => setActiveSheet("friend")}
              style={({ pressed }) => [styles.actionButton, pressed && styles.searchButtonPressed]}
              accessibilityRole="button"
              accessibilityLabel="Freund hinzufügen"
            >
              <AddFriendGlyph />
            </Pressable>
            <Pressable
              onPress={() => setActiveSheet("team")}
              style={({ pressed }) => [styles.actionButton, pressed && styles.searchButtonPressed]}
              accessibilityRole="button"
              accessibilityLabel="Team erstellen"
            >
              <Icon name="teams" size={28} color="#FFFFFF" />
            </Pressable>
          </View>

          {pendingSentRequests.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>AUSSTEHEND</Text>
              <View style={styles.card}>
                {pendingSentRequests.map((friend, index) => (
                  <View key={friend.id}>
                    {index > 0 && <View style={styles.rowDivider} />}
                    <View style={styles.friendRow}>
                      <Avatar name={friend.full_name} color={friend.avatar_color} size={32} />
                      <Text style={styles.friendName} numberOfLines={1}>
                        {friend.full_name ?? "Unbekannt"}
                      </Text>
                      <Text style={styles.pendingLabel}>Ausstehend</Text>
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}

          <Text style={styles.sectionLabel}>FREUNDE</Text>
          {friends.length === 0 ? (
            <Text style={styles.emptyText}>Noch keine Freunde hinzugefügt.</Text>
          ) : (
            <View style={styles.friendList}>
              {friends.map((friend) => (
                <View key={friend.id}>
                  <Swipeable
                    ref={(ref) => {
                      friendSwipeRefs.current[friend.id] = ref;
                    }}
                    renderRightActions={() => (
                      <Pressable
                        onPress={() => {
                          friendSwipeRefs.current[friend.id]?.close();
                          handleRemoveFriend(friend);
                        }}
                        style={styles.friendDeleteAction}
                        accessibilityRole="button"
                        accessibilityLabel={`${friend.full_name ?? "Unbekannt"} als Freund entfernen`}
                      >
                        <TrashGlyph color="#FFFFFF" />
                      </Pressable>
                    )}
                  >
                  <View style={[styles.card, styles.friendRow]}>
                    <Avatar
                      name={friend.full_name}
                      color={friend.avatar_color}
                      size={32}
                      status={
                        !onlineUserIds?.has(friend.id)
                          ? "offline"
                          : friend.is_do_not_disturb
                            ? "dnd"
                            : "online"
                      }
                    />
                    <View style={styles.friendInfo}>
                      <Text style={styles.friendName} numberOfLines={1}>
                        {friend.full_name ?? "Unbekannt"}
                      </Text>
                      {friend.is_out_of_office && (
                        <View style={styles.statusRow}>
                          <View style={styles.statusBadge}>
                            <Icon name="briefcase" size={14} color={colors.textMuted} />
                            <Text style={styles.statusText}>Out of office</Text>
                          </View>
                        </View>
                      )}
                    </View>
                    <Pressable
                      onPress={() => onMessageFriend?.(friend)}
                      hitSlop={8}
                      style={styles.messageButton}
                      accessibilityRole="button"
                      accessibilityLabel={`Nachricht an ${friend.full_name ?? "Unbekannt"} schreiben`}
                    >
                      <Icon name="send" size={22} color={colors.brandOrange} />
                    </Pressable>
                  </View>
                  </Swipeable>
                </View>
              ))}
            </View>
          )}

          {ownedTeams.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>DEINE TEAMS</Text>
              <View style={styles.card}>
                {ownedTeams.map((team, index) => (
                  <View key={team.id}>
                    {index > 0 && <View style={styles.rowDivider} />}
                    <View style={styles.teamRow}>
                      <AvatarStack profiles={team.members} size={28} />
                      <View style={styles.teamTextCol}>
                        <Text style={styles.friendName} numberOfLines={1}>
                          {team.name}
                        </Text>
                        <Text style={styles.teamMemberCount}>
                          {team.members.length} {team.members.length === 1 ? "Mitglied" : "Mitglieder"}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => handleDeleteTeam(team)}
                        hitSlop={8}
                        style={styles.messageButton}
                        accessibilityRole="button"
                        accessibilityLabel={`Team ${team.name} löschen`}
                      >
                        <TrashGlyph />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}

          {memberTeams.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>TEAMS, IN DENEN DU MITGLIED BIST</Text>
              <View style={styles.card}>
                {memberTeams.map((team, index) => {
                  const others = team.members.filter((member) => member.id !== currentUser?.id);
                  return (
                    <View key={team.id}>
                      {index > 0 && <View style={styles.rowDivider} />}
                      <View style={styles.teamRow}>
                        <AvatarStack profiles={team.members} size={28} />
                        <View style={styles.teamTextCol}>
                          <Text style={styles.friendName} numberOfLines={1}>
                            {team.name}
                          </Text>
                          <Text style={styles.teamMemberCount} numberOfLines={1}>
                            {others.length === 0
                              ? "Keine weiteren Mitglieder"
                              : others.map((member) => member.full_name ?? "Unbekannt").join(", ")}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={isModalMounted}
        animationType="none"
        transparent
        onRequestClose={closeSheet}
      >
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Animated.View style={[styles.modalBackdrop, { opacity: overlayOpacity }]} />
          <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} accessibilityLabel="Schließen" />

          <Animated.View style={[styles.modalSheet, { transform: [{ translateY: sheetTranslateY }] }]}>
            {renderedSheet === "friend" ? (
              <>
                <Text style={styles.modalTitle}>Freund hinzufügen</Text>

                <Text style={styles.fieldLabel}>E-MAIL</Text>
                <View style={styles.searchRow}>
                  <TextInput
                    style={styles.emailInput}
                    value={email}
                    onChangeText={(value) => {
                      setEmail(value);
                      setFoundProfile(null);
                      setSearchError(null);
                      setSentTo(null);
                    }}
                    onSubmitEditing={handleSearch}
                    placeholder="freund@beispiel.de"
                    placeholderTextColor={colors.textMutedLight}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    accessibilityLabel="E-Mail des Freundes"
                  />
                  <Pressable
                    onPress={handleSearch}
                    disabled={!email.trim() || isSearching}
                    accessibilityRole="button"
                    accessibilityLabel="Nutzer suchen"
                    style={({ pressed }) => [
                      styles.searchButton,
                      pressed && styles.searchButtonPressed,
                      (!email.trim() || isSearching) && styles.searchButtonDisabled,
                    ]}
                  >
                    {isSearching ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.searchButtonText}>Suchen</Text>
                    )}
                  </Pressable>
                </View>

                {searchError && (
                  <Text style={styles.searchErrorText} accessibilityRole="alert">
                    {searchError}
                  </Text>
                )}

                {foundProfile && (
                  <View style={styles.foundRow}>
                    <Avatar name={foundProfile.full_name} color={foundProfile.avatar_color} size={32} />
                    <Text style={styles.foundName} numberOfLines={1}>
                      {foundProfile.full_name ?? "Unbekannt"}
                    </Text>
                    {sentTo === foundProfile.id ? (
                      <Text style={styles.sentLabel}>Gesendet</Text>
                    ) : alreadyConnected ? (
                      <Text style={styles.sentLabel}>Bereits verbunden</Text>
                    ) : (
                      <Pressable
                        onPress={handleSendRequest}
                        disabled={isSending}
                        accessibilityRole="button"
                        accessibilityLabel={`Anfrage an ${foundProfile.full_name ?? "Nutzer"} senden`}
                        style={({ pressed }) => [
                          styles.addButton,
                          pressed && styles.searchButtonPressed,
                          isSending && styles.searchButtonDisabled,
                        ]}
                      >
                        {isSending ? (
                          <ActivityIndicator color={colors.brandOrange} size="small" />
                        ) : (
                          <Text style={styles.addButtonText}>Anfrage senden</Text>
                        )}
                      </Pressable>
                    )}
                  </View>
                )}
              </>
            ) : renderedSheet === "team" ? (
              <>
                <Text style={styles.modalTitle}>Team erstellen</Text>

                <Text style={styles.fieldLabel}>NAME</Text>
                <TextInput
                  style={styles.teamNameInput}
                  value={teamName}
                  onChangeText={setTeamName}
                  placeholder="z. B. Design Team"
                  placeholderTextColor={colors.textMutedLight}
                  accessibilityLabel="Teamname"
                />

                <Text style={[styles.fieldLabel, styles.teamMembersLabel]}>MITGLIEDER</Text>
                <ScrollView style={styles.modalList}>
                  {friends.map((friend, index) => {
                    const isSelected = teamMemberIds.includes(friend.id);
                    return (
                      <View key={friend.id}>
                        {index > 0 && <View style={styles.rowDivider} />}
                        <Pressable
                          onPress={() => toggleTeamMember(friend.id)}
                          style={styles.memberPickRow}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: isSelected }}
                          accessibilityLabel={friend.full_name ?? "Unbekannt"}
                        >
                          <Avatar name={friend.full_name} color={friend.avatar_color} size={26} />
                          <Text style={styles.friendName}>{friend.full_name ?? "Unbekannt"}</Text>
                          {isSelected && <Text style={styles.memberCheck}>✓</Text>}
                        </Pressable>
                      </View>
                    );
                  })}
                </ScrollView>

                {teamError && (
                  <Text style={styles.searchErrorText} accessibilityRole="alert">
                    {teamError}
                  </Text>
                )}

                <Pressable
                  onPress={handleCreateTeam}
                  disabled={!teamName.trim() || teamMemberIds.length === 0 || isCreatingTeam}
                  accessibilityRole="button"
                  accessibilityLabel="Team erstellen bestätigen"
                  style={({ pressed }) => [
                    styles.modalConfirmButton,
                    pressed && styles.searchButtonPressed,
                    (!teamName.trim() || teamMemberIds.length === 0 || isCreatingTeam) &&
                      styles.searchButtonDisabled,
                  ]}
                >
                  {isCreatingTeam ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.createTeamButtonText}>TEAM ERSTELLEN ({teamMemberIds.length})</Text>
                  )}
                </Pressable>
              </>
            ) : null}
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function TrashGlyph({ color = colors.priorityHighText }: { color?: string }) {
  return (
    <View style={glyphStyles.trash}>
      <View style={[glyphStyles.trashLid, { backgroundColor: color }]} />
      <View style={[glyphStyles.trashBody, { borderColor: color }]} />
    </View>
  );
}

function AddFriendGlyph() {
  return (
    <View style={glyphStyles.addFriend}>
      <View style={glyphStyles.addFriendHead} />
      <View style={glyphStyles.addFriendBody} />
      <View style={glyphStyles.addFriendPlusH} />
      <View style={glyphStyles.addFriendPlusV} />
    </View>
  );
}

const CARD_RADIUS = 15;

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.warmCream,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 19,
    paddingTop: Spacing.two,
    gap: Spacing.two,
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -Spacing.two,
  },
  backButtonIcon: {
    fontSize: 26,
    color: colors.ink,
  },
  headerTitle: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 22,
    color: colors.ink,
  },
  headerSpacer: {
    flex: 1,
  },
  headerDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginTop: Spacing.two,
  },
  scrollContent: {
    paddingHorizontal: 19,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  sectionLabel: {
    fontFamily: "DMMono_500Medium",
    fontSize: 12,
    letterSpacing: 0.5,
    color: colors.textMuted,
    marginBottom: -Spacing.two,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: CARD_RADIUS,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  fieldLabel: {
    fontFamily: "DMMono_500Medium",
    fontSize: 10,
    letterSpacing: 0.5,
    color: colors.textMutedLight,
  },
  searchRow: {
    flexDirection: "row",
    gap: Spacing.two,
    alignItems: "center",
  },
  emailInput: {
    flex: 1,
    fontFamily: "DMSans_500Medium",
    fontSize: 15,
    color: colors.ink,
    padding: 0,
  },
  searchButton: {
    height: 36,
    paddingHorizontal: Spacing.three,
    borderRadius: 10,
    backgroundColor: colors.brandOrange,
    alignItems: "center",
    justifyContent: "center",
  },
  searchButtonPressed: {
    opacity: 0.85,
  },
  searchButtonDisabled: {
    opacity: 0.5,
  },
  searchButtonText: {
    fontFamily: "DMMono_500Medium",
    fontSize: 12,
    letterSpacing: 0.5,
    color: "#FFFFFF",
  },
  searchErrorText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: colors.priorityHighText,
  },
  foundRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  foundName: {
    flex: 1,
    fontFamily: "DMSans_500Medium",
    fontSize: 14,
    color: colors.ink,
  },
  addButton: {
    backgroundColor: "rgba(232, 90, 26, 0.12)",
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  addButtonText: {
    fontFamily: "DMSans_500Medium",
    fontSize: 13,
    color: colors.brandOrange,
  },
  sentLabel: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: colors.textMuted,
  },
  friendList: {
    gap: Spacing.two,
  },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  friendDeleteAction: {
    backgroundColor: colors.priorityHighText,
    justifyContent: "center",
    alignItems: "center",
    width: 72,
    borderRadius: CARD_RADIUS,
    marginLeft: Spacing.two,
  },
  friendInfo: {
    flex: 1,
    gap: 2,
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statusText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    color: colors.textMuted,
  },
  friendName: {
    fontFamily: "DMSans_500Medium",
    fontSize: 14,
    color: colors.ink,
  },
  messageButton: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  pendingLabel: {
    fontFamily: "DMMono_400Regular",
    fontSize: 11,
    letterSpacing: 0.3,
    color: colors.textMutedLight,
  },
  rowDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: Spacing.two,
  },
  emptyText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: colors.textMuted,
  },
  errorText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: colors.priorityHighText,
  },
  teamRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  teamTextCol: {
    flex: 1,
    gap: 2,
  },
  teamMemberCount: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    color: colors.textMutedLight,
  },
  teamNameInput: {
    fontFamily: "DMSans_500Medium",
    fontSize: 15,
    color: colors.ink,
    padding: 0,
    paddingBottom: Spacing.two,
  },
  teamMembersLabel: {
    marginTop: Spacing.two,
  },
  memberPickRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  memberCheck: {
    color: colors.brandOrange,
    fontSize: 16,
    fontWeight: "700",
  },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  modalSheet: {
    backgroundColor: colors.warmCream,
    borderTopLeftRadius: CARD_RADIUS,
    borderTopRightRadius: CARD_RADIUS,
    paddingHorizontal: 19,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
    maxHeight: "75%",
  },
  modalTitle: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 18,
    color: colors.ink,
    marginBottom: Spacing.three,
  },
  modalList: {
    backgroundColor: "#FFFFFF",
    borderRadius: CARD_RADIUS,
    paddingHorizontal: Spacing.three,
    maxHeight: 280,
  },
  modalConfirmButton: {
    height: 49,
    borderRadius: CARD_RADIUS,
    backgroundColor: colors.brandOrange,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.three,
  },
  actionRow: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  actionButton: {
    flex: 1,
    height: 56,
    borderRadius: CARD_RADIUS,
    backgroundColor: colors.brandOrange,
    alignItems: "center",
    justifyContent: "center",
  },
  createTeamButtonText: {
    fontFamily: "DMMono_500Medium",
    fontSize: 13,
    letterSpacing: 0.5,
    color: "#FFFFFF",
  },
});

const glyphStyles = StyleSheet.create({
  trash: {
    width: 20,
    height: 20,
    alignItems: "center",
  },
  trashLid: {
    width: 14,
    height: 2,
    backgroundColor: colors.priorityHighText,
    borderRadius: 1,
  },
  trashBody: {
    width: 12,
    height: 13,
    marginTop: 1,
    borderWidth: 1.6,
    borderColor: colors.priorityHighText,
    borderTopWidth: 0,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  addFriend: {
    width: 24,
    height: 22,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  addFriendHead: {
    position: "absolute",
    top: 0,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    borderWidth: 1.8,
    borderColor: "#FFFFFF",
  },
  addFriendBody: {
    width: 15,
    height: 9,
    borderTopLeftRadius: 7.5,
    borderTopRightRadius: 7.5,
    borderWidth: 1.8,
    borderColor: "#FFFFFF",
    borderBottomWidth: 0,
  },
  addFriendPlusH: {
    position: "absolute",
    right: -1,
    top: 2,
    width: 9,
    height: 1.8,
    backgroundColor: "#FFFFFF",
    borderRadius: 1,
  },
  addFriendPlusV: {
    position: "absolute",
    right: 3,
    top: -2,
    width: 1.8,
    height: 9,
    backgroundColor: "#FFFFFF",
    borderRadius: 1,
  },
});
