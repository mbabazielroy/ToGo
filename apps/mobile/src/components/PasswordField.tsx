import { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { newPasswordProblem, passwordStrength, PASSWORD_MAX, type PasswordContext } from '@shared/lib/authRules';
import { radius, font, useColors, makeStyles } from '@/theme';

/**
 * A password input with a show/hide button. For a new password (`isNew`) it also
 * shows a strength meter and what's wrong, as the person types, and tells the
 * phone's password manager to suggest a strong one. Pasting is always allowed.
 */
export function PasswordField({
  label, value, onChange, isNew, context, onSubmit, testID,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  isNew?: boolean;
  context?: PasswordContext;
  onSubmit?: () => void;
  testID?: string;
}) {
  const colors = useColors();
  const styles = useStyles();
  const [shown, setShown] = useState(false);
  const problem = isNew && value.length > 0 ? newPasswordProblem(value, context) : null;
  const strength = isNew && value.length > 0 ? passwordStrength(value, context) : null;
  const meter = strength === 'strong' ? 3 : strength === 'ok' ? 2 : strength === 'weak' ? 1 : 0;
  const meterColor = strength === 'strong' ? colors.forest600 : strength === 'ok' ? colors.amber600 : colors.red600;

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          secureTextEntry={!shown}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          maxLength={PASSWORD_MAX * 2}
          textContentType={isNew ? 'newPassword' : 'password'}
          autoComplete={isNew ? 'new-password' : 'current-password'}
          passwordRules={isNew ? 'minlength: 12; required: lower; required: upper; required: digit;' : undefined}
          placeholder={isNew ? 'At least 8 characters' : undefined}
          placeholderTextColor={colors.muted}
          accessibilityLabel={label}
          returnKeyType={onSubmit ? 'go' : 'next'}
          onSubmitEditing={onSubmit}
          testID={testID}
        />
        <Pressable
          onPress={() => setShown((s) => !s)}
          accessibilityRole="button"
          accessibilityLabel={shown ? 'Hide password' : 'Show password'}
          hitSlop={8}
          style={styles.eye}
        >
          <Ionicons name={shown ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.muted} />
        </Pressable>
      </View>
      {isNew && value.length > 0 && (
        <View accessibilityLiveRegion="polite">
          <View style={styles.meter} accessibilityLabel={`Password strength: ${strength}`}>
            {[1, 2, 3].map((i) => (
              <View key={i} style={[styles.bar, { backgroundColor: i <= meter ? meterColor : colors.border }]} />
            ))}
          </View>
          <Text style={[styles.hint, problem ? { color: colors.red700 } : null]}>
            {problem ?? (strength === 'strong' ? 'Strong password.' : 'Good. Longer is stronger: try a few unrelated words.')}
          </Text>
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  label: { fontSize: font.tiny, fontWeight: '600', color: colors.muted, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, minHeight: 48 },
  input: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: font.body, color: colors.ink },
  eye: { paddingHorizontal: 12, paddingVertical: 10 },
  meter: { flexDirection: 'row', gap: 4, marginTop: 8 },
  bar: { flex: 1, height: 4, borderRadius: 2 },
  hint: { fontSize: font.tiny, color: colors.muted, marginTop: 6, lineHeight: 17 },
}));
