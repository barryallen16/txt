import { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import AppButton from "../../components/AppButton";
import AppHeader from "../../components/AppHeader";
import IconButton from "../../components/IconButton";
import Loading from "../../components/Loading";
import PixelIcon from "../../components/PixelIcon";
import { contactsAccess, loadPhoneContacts } from "../../lib/contacts";
import { colors, radius, space, type } from "../../lib/theme";
import {
  buildMobilePaymentLink,
  encodeLinkParam,
  validateAmount,
} from "../../lib/upi";

export default function ManualPayRequestScreen() {
  const [payee, setPayee] = useState("");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState("");

  const amountCheck = validateAmount(amount, null);
  // The link stays minimal: only the payee address. The amount, name and
  // note travel in the SMS text, never inside the link.
  const mobileCheck = buildMobilePaymentLink({ mobileOrVpa: payee });

  const canContinue = mobileCheck.valid && amountCheck.valid;

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  const continueToRecipients = () => {
    if (!canContinue || !mobileCheck.link) return;
    router.push({
      pathname: "/recipients",
      params: {
        link: encodeLinkParam(mobileCheck.link),
        amount: amountCheck.amount,
        name: name.trim(),
        note: note.trim(),
      },
    });
  };

  const openContactPicker = async () => {
    setContactsLoading(true);
    setPickerOpen(true);
    try {
      const access = await contactsAccess(true);
      if (access.granted) {
        const list = await loadPhoneContacts();
        setContacts(list);
      }
    } catch {
      // Keep empty list
    } finally {
      setContactsLoading(false);
    }
  };

  const selectContact = (contact) => {
    setPayee(contact.number);
    if (!name && contact.name) {
      setName(contact.name);
    }
    setPickerOpen(false);
  };

  const filteredContacts = contacts.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.number.replace(/\D/g, "").includes(q)
    );
  });

  return (
    <SafeAreaView style={styles.screen} edges={["bottom"]}>
      <AppHeader title="Request payment" onBack={goBack} />
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.section}>
            <View style={styles.labelRow}>
              <Text style={type.label}>PAYEE (MOBILE NUMBER OR UPI ID)</Text>
              <Pressable
                onPress={openContactPicker}
                accessibilityRole="button"
                accessibilityLabel="Pick from contacts"
                hitSlop={8}
              >
                <Text style={[type.label, styles.linkText]}>PICK CONTACT</Text>
              </Pressable>
            </View>
            <TextInput
              value={payee}
              onChangeText={setPayee}
              placeholder="e.g. 9876543210 or name@okhdfc"
              placeholderTextColor={colors.muted}
              style={[type.body, styles.input]}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Payee mobile number or UPI ID"
            />
            {payee.length > 0 && !mobileCheck.valid ? (
              <Text style={[type.muted, styles.errorText]}>
                {mobileCheck.reason}
              </Text>
            ) : null}
          </View>

          <View style={styles.section}>
            <Text style={type.label}>PAYEE NAME (OPTIONAL)</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Jayadithya"
              placeholderTextColor={colors.muted}
              style={[type.body, styles.input]}
              accessibilityLabel="Payee display name"
            />
          </View>

          <View style={styles.amountBlock}>
            <Text style={[type.label, styles.amountLabel]}>AMOUNT</Text>
            <View style={styles.inputRow}>
              <Text style={styles.currency}>₹</Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                placeholder="0"
                placeholderTextColor={colors.muted}
                style={[type.amount, styles.amountInput]}
                keyboardType="decimal-pad"
                maxLength={10}
                accessibilityLabel="Amount in rupees"
              />
            </View>

            <View style={styles.rule} />

            {amount.length > 0 && !amountCheck.valid ? (
              <Text style={[type.muted, styles.errorText]}>
                {amountCheck.reason}
              </Text>
            ) : null}
          </View>

          <View style={styles.section}>
            <Text style={type.label}>NOTE (OPTIONAL)</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="e.g. Dinner, Rent"
              placeholderTextColor={colors.muted}
              style={[type.body, styles.input]}
              maxLength={50}
              accessibilityLabel="Payment note"
            />
          </View>

          <View style={styles.notice}>
            <PixelIcon name="shield" size={16} color={colors.muted} />
            <Text style={[type.muted, styles.noticeText]}>
              The request carries the mobile number and the amount as text. The
              recipient can pay from any UPI app on their phone.
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <AppButton
            label="Continue"
            onPress={continueToRecipients}
            disabled={!canContinue}
          />
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={pickerOpen}
        animationType="slide"
        onRequestClose={() => setPickerOpen(false)}
      >
        <SafeAreaView style={styles.modalScreen} edges={["top", "bottom"]}>
          <View style={styles.modalHeader}>
            <Text style={type.heading}>Pick contact</Text>
            <IconButton
              icon="close"
              label="Close"
              onPress={() => setPickerOpen(false)}
            />
          </View>

          <View style={styles.searchBox}>
            <PixelIcon name="search" size={16} color={colors.muted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search name or number"
              placeholderTextColor={colors.muted}
              style={[type.body, styles.searchInput]}
              autoFocus
              accessibilityLabel="Search contacts"
            />
          </View>

          {contactsLoading ? (
            <Loading label="Reading contacts" style={styles.fill} />
          ) : (
            <SectionList
              sections={[{ title: "CONTACTS", data: filteredContacts }]}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.contactList}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => selectContact(item)}
                  style={({ pressed }) => [
                    styles.contactRow,
                    pressed && styles.contactPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name}, ${item.number}`}
                >
                  <Text style={type.bodyMedium} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={type.muted} numberOfLines={1}>
                    {item.number}
                  </Text>
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={[type.muted, styles.emptyText]}>
                  {contacts.length === 0
                    ? "No contacts found with phone numbers."
                    : "No matching contacts."}
                </Text>
              }
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  fill: {
    flex: 1,
  },
  content: {
    padding: space.lg,
    gap: space.lg,
  },
  section: {
    gap: space.xs,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  linkText: {
    color: colors.accent,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius,
    paddingHorizontal: space.md,
    backgroundColor: colors.panel,
    color: colors.text,
  },
  amountBlock: {
    gap: space.md,
  },
  amountLabel: {
    marginBottom: space.xs,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  currency: {
    fontFamily: type.amount.fontFamily,
    fontSize: 28,
    color: colors.muted,
  },
  amountInput: {
    flex: 1,
    padding: 0,
    color: colors.text,
  },
  rule: {
    height: 1,
    backgroundColor: colors.line,
  },
  errorText: {
    color: colors.danger,
    marginTop: space.xs,
  },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius,
  },
  noticeText: {
    flex: 1,
  },
  footer: {
    padding: space.lg,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  modalScreen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    margin: space.lg,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius,
    backgroundColor: colors.panel,
  },
  searchInput: {
    flex: 1,
    paddingVertical: space.md,
    color: colors.text,
  },
  contactList: {
    paddingHorizontal: space.lg,
    paddingBottom: space.xl,
  },
  contactRow: {
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    gap: 2,
  },
  contactPressed: {
    backgroundColor: colors.line,
  },
  emptyText: {
    textAlign: "center",
    paddingVertical: space.xl,
  },
});
