// ListInfoScreen.js
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    FlatList,
    Image,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';

export default function ListInfoScreen() {
  const router = useRouter();
  const { listName, description, members } = useLocalSearchParams();
  const memberArr = members ? JSON.parse(members) : [];
  const insets = useSafeAreaInsets();

  const renderMember = ({ item }) => (
    <View style={styles.memberRow}>
      <Image source={{ uri: item.img }} style={styles.avatar} />
      <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#1f6ea7" barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{listName}</Text>
        <TouchableOpacity onPress={() => {/* TODO: more menu */}} style={styles.iconBtn}>
                  <Icon name="person-add" size={24} color="#fff" />
                </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>

        {/* 1) Description Card */}
        
       <View style={[styles.card, styles.sectionContainer]}>
        <Text style={styles.title}>Description</Text>
          {description ? (
            <Text style={styles.description}>{description}</Text>
          ) : null}
        </View>

        {/* 2) Members Card */}
       <View style={[styles.card, styles.sectionContainer]}>
          <Text style={styles.section}>Shared With</Text>
          <FlatList
            data={memberArr}
            keyExtractor={item => item.id}
            renderItem={renderMember}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
          />
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f0f0' }, // light gray bg

  // Header
  header: {
    height: 56,
    backgroundColor: '#1f6ea7',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  iconBtn: { padding: 8 },
  headerTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },


  // Content wrapper
  content: {
    paddingTop: 16,
    paddingBottom: 16,
    // no horizontal padding so cards can go edge-to-edge
  },
  // shared by both cards
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    // shadow for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    // elevation for Android
    elevation: 3,
    alignSelf: 'stretch',
    marginHorizontal: 0,
  },
  sectionContainer: {
    marginBottom: 16,
  },

  // Title & Description inside first card
  title: { fontSize: 13, fontWeight: '400', marginBottom: 8 },
  description: { fontSize: 16, color: '#000' },

  // Section label inside members card
  section: { fontSize: 13, fontWeight: '400', marginBottom: 12 },

  // Member row styling
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  name: { fontSize: 16, flexShrink: 1, color: '#333' },
});
