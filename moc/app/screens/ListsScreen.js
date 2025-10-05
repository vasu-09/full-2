// ListsScreen.js
import { useRouter } from 'expo-router';
import {
  FlatList,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { SafeAreaView } from 'react-native-safe-area-context';


const HEADER_HEIGHT = 56;

const userLists = Array.from({ length: 10 }).map((_, i) => ({
  id: String(i + 1),
  name: 'Grocery List',
}));

const bgColors = ['#1f6ea7', '#64792A', '#E6A23C', '#67C23A', '#909399'];

export default function ListsScreen() {
  const router = useRouter();
  const renderListItem = ({ item, index }) => {
    const bg = bgColors[index % bgColors.length];
    return (
      <TouchableOpacity style={styles.listItem} onPress={() =>router.push('/screens/ViewListScreen')}>
        <View style={[styles.iconCircle, { backgroundColor: bg }]}>
          <Icon name="shopping-cart" size={24} color="#fff" />
        </View>
        <Text style={styles.listName}>{item.name}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => {
  router.replace('/screens/MocScreen');
}}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={styles.headerTitle}>Select List</Text>
          <Text style={styles.headerSubtitle}>{userLists.length} lists</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtn}>
            <Icon name="search" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn}>
            <Icon name="more-vert" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* New List */}
      <View style={styles.newListContainer}>
        <TouchableOpacity style={styles.newListBtn} onPress={() =>  router.push('/screens/NewListScreen')}>
          <View style={[styles.iconCircle, { backgroundColor: '#1f6ea7' }]}>
            <Icon name="playlist-add" size={24} color="#fff" />
          </View>
          <Text style={styles.newListTitle}>New list</Text>
        </TouchableOpacity>
      </View>

      {/* Section header */}
      <Text style={styles.sectionTitle}>Lists you have on MoC</Text>

      {/* Existing Lists */}
      <FlatList
        data={userLists}
        keyExtractor={item => item.id}
        renderItem={renderListItem}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    height: HEADER_HEIGHT,
    backgroundColor: '#1f6ea7',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  iconBtn: {
    padding: 4,
  },
  titleContainer: {
    flex: 1,
    marginLeft: 4,
    justifyContent:'center'
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#e0f2ff',
    fontSize: 12,
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
  },

  newListContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    // no border here
  },
  newListBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  newListTitle: {
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },

  sectionTitle: {
    marginTop: 12,
    marginHorizontal: 12,
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },

  listContainer: {
    paddingTop: 8,
    paddingHorizontal: 12,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listName: {
    marginLeft: 12,
    fontSize: 16,
    color: '#333',
  },
});
