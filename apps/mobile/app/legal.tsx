import { View, Text, ScrollView, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavBar, Group, ListRow } from '@/components/ui';
import { PRIVACY, TERMS } from '@/legal/content';
import { PRIVACY_URL, TERMS_URL, SUPPORT_EMAIL } from '@/env';
import { space, font, SCREEN, makeStyles } from '@/theme';

/** Privacy policy and terms of use, readable before and after signing in. */
export default function Legal() {
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { doc } = useLocalSearchParams<{ doc?: string }>();
  const terms = doc === 'terms';
  const d = terms ? TERMS : PRIVACY;
  const url = terms ? TERMS_URL : PRIVACY_URL;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <NavBar title={d.title} onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: SCREEN, paddingBottom: insets.bottom + space.xxl, gap: space.lg }}>
        <View>
          <Text style={styles.updated}>Last updated {d.updated}</Text>
          <Text style={styles.intro}>{d.intro}</Text>
        </View>
        {d.sections.map((s) => (
          <View key={s.heading} style={{ gap: space.sm }}>
            <Text style={styles.heading} accessibilityRole="header">{s.heading}</Text>
            {s.body.map((p) => <Text key={p.slice(0, 40)} style={styles.p}>{p}</Text>)}
          </View>
        ))}
        <Group>
          {url ? <ListRow icon="open-outline" title="Open the full version" subtitle={url} onPress={() => Linking.openURL(url).catch(() => {})} /> : null}
          {SUPPORT_EMAIL ? <ListRow icon="mail-outline" title="Questions?" subtitle={SUPPORT_EMAIL} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {})} /> : null}
          <ListRow icon={terms ? 'shield-checkmark-outline' : 'document-text-outline'} title={terms ? 'Privacy policy' : 'Terms of use'} onPress={() => router.replace(terms ? '/legal?doc=privacy' : '/legal?doc=terms')} />
        </Group>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.bg },
  updated: { fontSize: font.tiny, color: colors.muted, fontWeight: '600' },
  intro: { fontSize: font.body, color: colors.inkSoft, lineHeight: 24, marginTop: space.xs },
  heading: { fontSize: font.title, fontWeight: '700', color: colors.ink },
  p: { fontSize: font.small, color: colors.inkSoft, lineHeight: 21 },
}));
