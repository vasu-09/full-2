// ViewListScreen.js
import { useRouter } from 'expo-router';
import {
  FlatList,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

// Dummy data
const DUMMY_LIST = {
  listName : "Weekend Groceries",
  description: "Stuff to pick up before Saturday afternoon — fruits, veggies, and snacks!",
  members: [
    {
      "id": "u1",
      "name": "Alice Johnson",
      "img": "https://randomuser.me/api/portraits/women/44.jpg"
    },
    {
      "id": "u2",
      "name": "Bob Smith",
      "img": "https://randomuser.me/api/portraits/men/46.jpg"
    },
    {
      "id": "u3",
      "name": "Carla Reyes",
      "img": "https://randomuser.me/api/portraits/women/47.jpg"
    },
    {
      "id": "u4",
      "name": "David Lee",
      "img": "https://randomuser.me/api/portraits/men/50.jpg"
    },
    {
      "id": "u5",
      "name": "Eva Patel",
      "img": "https://randomuser.me/api/portraits/women/52.jpg"
    }
  ],
    items: [
    {
      itemName: 'Sugar',
      quantity: '1kg',
      priceText: '₹50',
      subQuantities: [
        { quantity: '500gm', priceText: '₹25' },
        { quantity: '250gm', priceText: '₹15' },
        { quantity: '100gm', priceText: '₹5' },
      ],
    },
    {
      itemName: 'Salt',
      quantity: '500gm',
      priceText: '₹20',
      subQuantities: [
        { quantity: '250gm', priceText: '₹10' },
      ],
    },
    // add more items as needed
  ],
}




export default function ViewListScreen() {
  
  const router = useRouter();
  const renderItem = ({ item }) => (
    <View style={styles.itemContainer}>
      {/* Row 1: name + edit/delete */}
      <View style={styles.row1}>
        <Text style={styles.itemName}>{item.itemName}</Text>
        <View style={styles.icons}>
         <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: '/screens/EditItemScreen',
                params: { item: JSON.stringify(item) },
              })
            }
          >
            <Icon name="edit" size={20} color="#333" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { /* TODO: delete */ }} style={styles.iconSpacing}>
            <Icon name="delete" size={20} color="#333" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Row 2: quantity on left, price on right */}
      <View style={styles.row2}>
        <Text style={styles.detailText}>{item.quantity}</Text>
        <Text style={styles.detailText}>{item.priceText}</Text>
      </View>

      {/* Sub‑quantities (indented) */}
      {item.subQuantities.map((sub, i) => (
        <View key={i} style={styles.subRow}>
          <Text style={styles.subText}>{sub.quantity}</Text>
          <Text style={styles.subText}>{sub.priceText}</Text>
        </View>
      ))}
    </View>
  );

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
        <TouchableOpacity
            style={styles.titleContainer}
            onPress={() => router.push({
              pathname: '/screens/ListInfoScreen',
              params: {  listName: DUMMY_LIST.listName,
        description: DUMMY_LIST.description,
        members: JSON.stringify(DUMMY_LIST.members), },
            })}
          >
            <Text style={styles.headerTitle}>{DUMMY_LIST.listName}</Text>
          </TouchableOpacity>
        <TouchableOpacity onPress={() => {/* TODO: more menu */}} style={styles.iconBtn}>
          <Icon name="more-vert" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* List items */}
      <FlatList
        data={DUMMY_LIST.items}
        keyExtractor={(_, idx) => idx.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
      />
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

  titleContainer: {
  flex: 1,
  justifyContent: 'center',
   alignSelf: 'stretch',
},
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },

  list: {
    paddingVertical: 8,
  },
  itemContainer: {
    borderBottomWidth: 1,
    borderColor: '#eee',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },

  row1: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  icons: {
    flexDirection: 'row',
  },
  iconSpacing: {
    marginLeft: 16,
  },

  row2: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  detailText: {
    fontSize: 14,
    color: '#555',
  },

  subRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingLeft: 24,
    marginTop: 4,
  },
  subText: {
    fontSize: 13,
    color: '#777',
  },
});
