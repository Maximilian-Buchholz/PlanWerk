import { DMMono_400Regular, DMMono_500Medium } from "@expo-google-fonts/dm-mono";
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
} from "@expo-google-fonts/dm-sans";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/avatar";
import { Icon } from "@/components/icons";
import { Spacing } from "@/constants/theme";
import type { AppNotification } from "@/lib/friends";
import { avatarFallbackColor, colors } from "@/theme/colors";
import type { Profile } from "@/types/tasks";

SplashScreen.preventAutoHideAsync().catch(() => {});

function isToday(isoDate: string): boolean {
  const date = new Date(isoDate);
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function formatCardDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (isToday(isoDate)) return "Heute";

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()
  ) {
    return "Gestern";
  }

  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function typeLabel(type: AppNotification["type"]): string {
  switch (type) {
    case "friend_request":
      return "Freundschaftsanfrage";
    case "friend_request_accepted":
      return "Anfrage angenommen";
    case "direct_message":
      return "Nachricht";
    case "task_assigned":
      return "Aufgabe zugewiesen";
    case "task_updated":
      return "Aufgabe aktualisiert";
    case "team_added":
      return "Team-Einladung";
    default:
      return "Nachricht";
  }
}

export type InboxScreenProps = {
  currentUser?: Profile;
  notifications: AppNotification[];
  sentMessages?: AppNotification[];
  loadError?: string | null;
  onOpenNotification?: (notificationId: string) => void;
  onAcceptFriendRequest?: (notification: AppNotification) => void;
  onDeclineFriendRequest?: (notification: AppNotification) => void;
  onDeleteNotifications?: (notificationIds: string[]) => Promise<void> | void;
  refreshing?: boolean;
  onRefresh?: () => void;
  onBack?: () => void;
  onPressAvatar?: () => void;
};

type Filter = "all" | "unread" | "sent";

export function InboxScreen({
  currentUser,
  notifications,
  sentMessages = [],
  loadError,
  onOpenNotification,
  onAcceptFriendRequest,
  onDeclineFriendRequest,
  onDeleteNotifications,
  refreshing,
  onRefresh,
  onBack,
  onPressAvatar,
}: InboxScreenProps) {
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

  const [filter, setFilter] = useState<Filter>("all");
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  const isSelecting = selectedIds.size > 0;
  const isSentView = filter === "sent";

  function changeFilter(next: Filter) {
    setSelectedIds(new Set());
    setFilter(next);
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleDeleteSelected() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    Alert.alert(
      ids.length === 1 ? "Nachricht löschen?" : `${ids.length} Nachrichten löschen?`,
      "Das kann nicht rückgängig gemacht werden.",
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Löschen",
          style: "destructive",
          onPress: async () => {
            setIsDeleting(true);
            try {
              await onDeleteNotifications?.(ids);
              setSelectedIds(new Set());
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ],
    );
  }

  const unreadCount = notifications.filter((item) => !item.isRead).length;
  const visible = isSentView
    ? sentMessages
    : filter === "unread"
      ? notifications.filter((item) => !item.isRead)
      : notifications;

  const sections = [
    { title: "HEUTE", data: visible.filter((item) => isToday(item.createdAt)) },
    { title: "FRÜHER", data: visible.filter((item) => !isToday(item.createdAt)) },
  ].filter((section) => section.data.length > 0);

  async function handleRespond(notification: AppNotification, accept: boolean) {
    if (respondingId) return;
    setRespondingId(notification.id);
    try {
      if (accept) {
        await onAcceptFriendRequest?.(notification);
      } else {
        await onDeclineFriendRequest?.(notification);
      }
    } finally {
      setRespondingId(null);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => (isSelecting ? setSelectedIds(new Set()) : onBack?.())}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={isSelecting ? "Auswahl abbrechen" : "Zurück"}
          style={styles.backButton}
        >
          <Text style={styles.backButtonIcon}>{isSelecting ? "✕" : "‹"}</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{isSelecting ? `${selectedIds.size} ausgewählt` : "Postfach"}</Text>
        <View style={styles.headerSpacer} />
        {isSelecting ? (
          <Pressable
            onPress={handleDeleteSelected}
            disabled={isDeleting}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Ausgewählte Nachrichten löschen"
            style={styles.deleteHeaderButton}
          >
            {isDeleting ? (
              <ActivityIndicator color={colors.priorityHighText} size="small" />
            ) : (
              <TrashGlyph />
            )}
          </Pressable>
        ) : (
          <Pressable
            onPress={onPressAvatar}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Zum Profil"
          >
            <Avatar name={currentUser?.full_name ?? null} color={currentUser?.avatar_color ?? avatarFallbackColor} shape="square" size={40} />
          </Pressable>
        )}
      </View>
      <View style={styles.headerDivider} />

      <View style={styles.filterRow}>
        <Pressable
          onPress={() => changeFilter("all")}
          style={[styles.filterPill, filter === "all" && styles.filterPillActive]}
          accessibilityRole="button"
          accessibilityLabel={`Alle, ${notifications.length}`}
          accessibilityState={{ selected: filter === "all" }}
        >
          <Text style={[styles.filterText, filter === "all" && styles.filterTextActive]}>Alle</Text>
          <View style={[styles.filterBadge, filter === "all" && styles.filterBadgeActive]}>
            <Text style={[styles.filterBadgeText, filter === "all" && styles.filterBadgeTextActive]}>
              {notifications.length}
            </Text>
          </View>
        </Pressable>

        <Pressable
          onPress={() => changeFilter("unread")}
          style={[styles.filterPill, filter === "unread" && styles.filterPillActive]}
          accessibilityRole="button"
          accessibilityLabel={`Ungelesen, ${unreadCount}`}
          accessibilityState={{ selected: filter === "unread" }}
        >
          <Text style={[styles.filterText, filter === "unread" && styles.filterTextActive]}>
            Ungelesen
          </Text>
          <View style={[styles.filterBadge, filter === "unread" && styles.filterBadgeActive]}>
            <Text style={[styles.filterBadgeText, filter === "unread" && styles.filterBadgeTextActive]}>
              {unreadCount}
            </Text>
          </View>
        </Pressable>

        <Pressable
          onPress={() => changeFilter("sent")}
          style={[styles.filterPill, filter === "sent" && styles.filterPillActive]}
          accessibilityRole="button"
          accessibilityLabel={`Gesendet, ${sentMessages.length}`}
          accessibilityState={{ selected: filter === "sent" }}
        >
          <Text style={[styles.filterText, filter === "sent" && styles.filterTextActive]}>Gesendet</Text>
          <View style={[styles.filterBadge, filter === "sent" && styles.filterBadgeActive]}>
            <Text style={[styles.filterBadgeText, filter === "sent" && styles.filterBadgeTextActive]}>
              {sentMessages.length}
            </Text>
          </View>
        </Pressable>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl refreshing={refreshing ?? false} onRefresh={onRefresh} tintColor={colors.brandOrange} />
        }
        renderSectionHeader={({ section }) => <Text style={styles.sectionLabel}>{section.title}</Text>}
        ListEmptyComponent={
          loadError ? (
            <Text style={styles.errorText} accessibilityRole="alert">
              {loadError}
            </Text>
          ) : (
            <Text style={styles.emptyText}>
              {isSentView
                ? "Noch keine gesendeten Nachrichten."
                : filter === "unread"
                  ? "Keine ungelesenen Nachrichten."
                  : "Noch keine Nachrichten."}
            </Text>
          )
        }
        renderItem={({ item }) => {
          const showActions =
            item.type === "friend_request" && !item.isRead && !isSelecting && !isSentView;
          const isSelected = selectedIds.has(item.id);
          const other = isSentView ? item.recipient : item.sender;
          return (
            <Pressable
              onPress={() => {
                if (isSentView) return;
                isSelecting ? toggleSelected(item.id) : onOpenNotification?.(item.id);
              }}
              onLongPress={() => {
                if (!isSentView) toggleSelected(item.id);
              }}
              style={[styles.card, !item.isRead && styles.cardUnread, isSelected && styles.cardSelected]}
              accessibilityRole="button"
              accessibilityLabel={other?.full_name ?? "Nachricht"}
              accessibilityState={{ selected: isSelected }}
            >
              <View style={styles.cardTopRow}>
                {isSelecting && !isSentView && (
                  <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                    {isSelected && <Text style={styles.checkboxMark}>✓</Text>}
                  </View>
                )}
                <Avatar
                  name={other?.full_name ?? null}
                  color={other?.avatar_color ?? avatarFallbackColor}
                  size={44}
                />
                <View style={styles.cardTextCol}>
                  <Text style={styles.senderName} numberOfLines={1}>
                    {isSentView ? `An ${other?.full_name ?? "Unbekannt"}` : (other?.full_name ?? "System")}
                  </Text>
                  <Text style={styles.typeLabel} numberOfLines={1}>
                    {typeLabel(item.type)}
                  </Text>
                </View>
                <Text style={styles.dateLabel}>{formatCardDate(item.createdAt)}</Text>
              </View>

              <ExpandableBody text={item.title} />

              {showActions && (
                <>
                  <View style={styles.cardDivider} />
                  <View style={styles.actionsRow}>
                    <Pressable
                      onPress={() => handleRespond(item, false)}
                      disabled={respondingId === item.id}
                      accessibilityRole="button"
                      accessibilityLabel="Anfrage ablehnen"
                      style={styles.declineButton}
                    >
                      <Text style={styles.declineButtonText}>Ablehnen</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleRespond(item, true)}
                      disabled={respondingId === item.id}
                      accessibilityRole="button"
                      accessibilityLabel="Anfrage annehmen"
                      style={styles.acceptButton}
                    >
                      {respondingId === item.id ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <Text style={styles.acceptButtonText}>Annehmen</Text>
                      )}
                    </Pressable>
                  </View>
                </>
              )}
            </Pressable>
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.two }} />}
        SectionSeparatorComponent={() => <View style={{ height: Spacing.three }} />}
      />
    </SafeAreaView>
  );
}

const BODY_LINE_HEIGHT = 20;
const BODY_COLLAPSED_LINES = 2;
const BODY_EXPAND_DURATION_MS = 300;
const BODY_EXPAND_EASING = Easing.bezier(0.4, 0, 0.2, 1);
/** Rough length at which two lines of text overflow; only used to decide whether to offer the arrow. */
const BODY_LONG_TEXT_CHARS = 80;

/** Message text clamped to two lines; long messages get an arrow that expands them like a task card. */
function ExpandableBody({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  // The ellipsis only works with numberOfLines, so it is dropped while expanded/animating.
  const [clamped, setClamped] = useState(true);
  const progress = useSharedValue(0);
  const fullHeight = useSharedValue(0);
  const collapsedHeight = BODY_LINE_HEIGHT * BODY_COLLAPSED_LINES;
  const isLong = text.length > BODY_LONG_TEXT_CHARS || text.split("\n").length > BODY_COLLAPSED_LINES;

  useEffect(() => {
    progress.value = withTiming(expanded ? 1 : 0, {
      duration: BODY_EXPAND_DURATION_MS,
      easing: BODY_EXPAND_EASING,
    });
    if (expanded) {
      setClamped(false);
      return;
    }
    const timer = setTimeout(() => setClamped(true), BODY_EXPAND_DURATION_MS);
    return () => clearTimeout(timer);
  }, [expanded, progress]);

  const bodyStyle = useAnimatedStyle(() => ({
    height:
      fullHeight.value > collapsedHeight
        ? collapsedHeight + (fullHeight.value - collapsedHeight) * progress.value
        : undefined,
  }));
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${(1 - progress.value) * 180}deg` }],
  }));

  if (!isLong) {
    return <Text style={[styles.bodyText, styles.bodyWrap]}>{text}</Text>;
  }

  return (
    <View>
      <View style={styles.bodyWrap}>
        <Animated.View style={[styles.bodyClip, bodyStyle]}>
          <Text style={styles.bodyText} numberOfLines={clamped ? BODY_COLLAPSED_LINES : undefined}>
            {text}
          </Text>
        </Animated.View>
        {/* Invisible copy that reports the full text height for the animation. */}
        <Text
          style={[styles.bodyText, styles.bodyMeasure]}
          pointerEvents="none"
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          onLayout={(event) => {
            fullHeight.value = event.nativeEvent.layout.height;
          }}
        >
          {text}
        </Text>
      </View>
      {/* Spans the whole card so the arrow sits centered on it. */}
      <View style={styles.bodyChevronRow}>
        <Pressable
          onPress={() => setExpanded((value) => !value)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={expanded ? "Nachricht einklappen" : "Nachricht ausklappen"}
        >
          <Animated.View style={chevronStyle}>
            <Icon name="chevronUp" size={20} color={colors.textMutedLight} />
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
}

function TrashGlyph() {
  return (
    <View style={glyphStyles.trash}>
      <View style={glyphStyles.trashLid} />
      <View style={glyphStyles.trashBody} />
    </View>
  );
}

const CARD_RADIUS = 15;

const styles = StyleSheet.create({
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
  deleteHeaderButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginTop: Spacing.two,
  },
  filterRow: {
    flexDirection: "row",
    gap: Spacing.two,
    paddingHorizontal: 19,
    paddingTop: Spacing.three,
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingHorizontal: Spacing.three,
    height: 34,
  },
  filterPillActive: {
    backgroundColor: colors.brandOrange,
  },
  filterText: {
    fontFamily: "DMSans_500Medium",
    fontSize: 14,
    color: colors.textMuted,
  },
  filterTextActive: {
    color: "#FFFFFF",
  },
  filterBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.warmCream,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  filterBadgeActive: {
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  filterBadgeText: {
    fontFamily: "DMMono_500Medium",
    fontSize: 11,
    color: colors.textMuted,
  },
  filterBadgeTextActive: {
    color: "#FFFFFF",
  },
  listContent: {
    paddingHorizontal: 18,
    paddingTop: Spacing.four,
    paddingBottom: 110,
  },
  sectionLabel: {
    fontFamily: "DMMono_500Medium",
    fontSize: 12,
    letterSpacing: 0.5,
    color: colors.textMuted,
    marginBottom: Spacing.two,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: CARD_RADIUS,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  cardUnread: {
    borderWidth: 1,
    borderColor: colors.brandOrange,
  },
  cardSelected: {
    backgroundColor: "rgba(232, 90, 26, 0.08)",
    borderWidth: 1,
    borderColor: colors.brandOrange,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "rgba(44, 44, 44, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: colors.brandOrange,
    borderColor: colors.brandOrange,
  },
  checkboxMark: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  cardTextCol: {
    flex: 1,
    gap: 2,
  },
  senderName: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 16,
    color: colors.ink,
  },
  typeLabel: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    color: colors.textMutedLight,
  },
  dateLabel: {
    fontFamily: "DMSans_500Medium",
    fontSize: 12,
    color: colors.brandOrange,
  },
  bodyText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    lineHeight: BODY_LINE_HEIGHT,
    color: colors.ink,
  },
  bodyWrap: {
    marginLeft: 44 + Spacing.two,
  },
  bodyClip: {
    overflow: "hidden",
  },
  bodyMeasure: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    opacity: 0,
  },
  // The pull-back of -Spacing.two cancels half of the card's bottom padding, so the
  // arrow sits evenly between the message and the card's bottom edge.
  bodyChevronRow: {
    alignItems: "center",
    paddingTop: Spacing.two,
    marginBottom: -Spacing.two,
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  declineButton: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  declineButtonText: {
    fontFamily: "DMMono_500Medium",
    fontSize: 12,
    letterSpacing: 0.3,
    color: colors.textMuted,
  },
  acceptButton: {
    backgroundColor: "rgba(232, 90, 26, 0.12)",
    borderRadius: 10,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    minWidth: 96,
    alignItems: "center",
  },
  acceptButtonText: {
    fontFamily: "DMMono_500Medium",
    fontSize: 12,
    letterSpacing: 0.3,
    color: colors.brandOrange,
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
});
