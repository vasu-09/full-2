import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  FlatList,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { SafeAreaView } from 'react-native-safe-area-context';

// Dummy data for preview


export default function PreviewScreen() {
  const { listName, items } = useLocalSearchParams();
  const parsedItems = JSON.parse(items || '[]');
  const router = useRouter();
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#1f6ea7" barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/screens/MocScreen');
        }} style={styles.iconBtn}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Preview</Text>
      </View>

      {/* List title and image */}
      <View style={styles.topInfo}>
        <View style={styles.imagePlaceholder}>
          <Icon name="image" size={32} color="#ccc" />
        </View>
        <Text style={styles.listTitle}>{listName}</Text>
      </View>

      {/* Items and sub-quantities */}
      <FlatList
        data={parsedItems}
        keyExtractor={(_, idx) => idx.toString()}
        contentContainerStyle={styles.listContainer}
         renderItem={({ item }) => {
          const hasDetails =
            !!item.quantity ||
            !!item.unit ||
            !!item.price ||
            (item.subQuantities && item.subQuantities.length > 0);
          return (
            <View style={styles.itemBlock}>
              <Text style={styles.itemName}>{item.name}</Text>
              {hasDetails && (
                <>
                  {(item.quantity || item.unit || item.price) && (
                    <View style={styles.row}>
                      <Text style={styles.itemQty}>{`${item.quantity}${item.unit}`}</Text>
                      {item.price ? (
                        <Text style={styles.itemPrice}>{`₹${item.price}`}</Text>
                      ) : null}
                    </View>
                  )}
                  {item.subQuantities.map((sub, i) => (
                    <View style={styles.subRow} key={i}>
                      <Text style={styles.subQty}>{`${sub.quantity}${sub.unit}`}</Text>
                      {sub.price ? (
                        <Text style={styles.subPrice}>{`₹${sub.price}`}</Text>
                      ) : null}
                    </View>
                  ))}
                </>
              )}
            </View>
          );
        }}
      />

      {/* Save button */}
      <TouchableOpacity style={styles.saveBtn} onPress={() =>  {router.push({
      pathname: '/screens/LinkListScreen',
      params: {
        listName,
        items: JSON.stringify(parsedItems), // ✅ Use the already parsed array
      },})}}>
        <Text style={styles.saveText}>Save</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    height: 56,
    backgroundColor: '#1f6ea7',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  iconBtn: { padding: 8 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginLeft: 8 },

  topInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  imagePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  listTitle: { fontSize: 16, fontWeight: '600', color: '#333' },

  listContainer: { padding: 12 },
  itemBlock: {
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  itemName: { fontSize: 16, fontWeight: '600', color: '#000' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  itemQty: { fontSize: 14, color: '#555' },
  itemPrice: { fontSize: 14, color: '#555' },

  subRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingLeft: 16,
  },
  subQty: { fontSize: 14, color: '#777' },
  subPrice: { fontSize: 14, color: '#777' },

  saveBtn: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: '#1f6ea7',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    elevation: 4,
  },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});


