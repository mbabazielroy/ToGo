import { View, Text } from 'react-native';
import { Group, SectionHeading, Segmented } from '@/components/ui';
import { haptics } from '@/lib/feedback';
import { makeStyles, useTheme, SCREEN, space, font, type AppearancePreference } from '@/theme';

const OPTIONS: { value: AppearancePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/** "Appearance" on the Account and crew profile screens. */
export function AppearanceSetting() {
  const styles = useStyles();
  const { preference, setPreference, scheme } = useTheme();
  return (
    <View>
      <SectionHeading title="Appearance" />
      <Group>
        <View style={styles.body}>
          <Segmented
            segments={OPTIONS}
            value={preference}
            onChange={(v) => { haptics.select(); setPreference(v); }}
            accessibilityLabel="Appearance"
          />
          <Text style={styles.note}>
            {preference === 'system'
              ? `Matches your phone’s setting (now ${scheme}).`
              : `Always ${preference}, whatever your phone is set to.`}
          </Text>
        </View>
      </Group>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  body: { padding: SCREEN, gap: space.sm },
  note: { fontSize: font.tiny, color: colors.muted, lineHeight: 17 },
}));
