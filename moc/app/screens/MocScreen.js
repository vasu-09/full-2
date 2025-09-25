import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Dimensions, Image, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';


const windowHeight = Dimensions.get('window').height;


const dummyContacts = [
  { name: 'Harika', img: 'https://static.toiimg.com/photo/119128176.cms' },
  { name: 'Sushma', img: 'https://documents.iplt20.com/ipl/IPLHeadshot2025/2.png' },
  { name: 'Shankar', img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/32/Pawan2.jpg/250px-Pawan2.jpg' },
  { name: 'Seetha', img: 'https://images.filmibeat.com/img/popcorn/profile_photos/sushmithabhat-20240312181216-62185.jpg' },
  { name: 'Mohan', img: 'https://upload.wikimedia.org/wikipedia/commons/9/95/Priyanka_Arul_Mohan_at_Etharkkum_Thunindhavan_pre_release_event_%28cropped%29.jpg' },
];

// Chats Screen

// Main MoC Screen
const MocScreen = () => {
  const insets = useSafeAreaInsets();
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);
  const Tab = createMaterialTopTabNavigator();
  const hideMenu = () => setMenuVisible(false);
  const [selectedUser, setSelectedUser] = useState(null); // stores clicked user details

  const router = useRouter();

  const onMenuSelect = action => {
    hideMenu();
    switch (action) {
      case 'new-group':
        // TODO
        return;
      case 'new-contact':
        // TODO
        return;
      case 'create-list':
        router.push('/screens/ListsScreen');
        return;
      case 'settings':
        // TODO
        return router.push('/screens/SettingsScreen');
    }
  };
  const ChatsScreen = () => {
  // <— replace this with real chat data when you have it
  const chatList = [
    { id: 1, name: 'Weekend', lastMessage: 'Sofia: Sticker', time: '9:49', avatar: 'https://randomuser.me/api/portraits/women/1.jpg' },
    { id: 2, name: 'João Pereira', lastMessage: 'typing…',       time: '9:45', avatar: 'https://randomuser.me/api/portraits/men/2.jpg' },
    { id: 3, name: 'Isabelle van Rijn', lastMessage: 'Best breakfast ever', time: '9:37', avatar: 'https://randomuser.me/api/portraits/women/3.jpg' },
    { id: 4, name: 'Family', lastMessage: 'Mom: She is so cute 😍', time: '9:09', avatar: 'https://randomuser.me/api/portraits/women/4.jpg' },
  ];

  const router = useRouter();

  

  return (
    <View style={styles.chatsWrapper}>
      <ScrollView contentContainerStyle={chatList.length ? styles.chatListContainer : { flexGrow: 1 }}>
        {chatList.length ? (
          // render chat items
          chatList.map(chat => (
            <View key={chat.id} style={styles.chatItem}>
              <TouchableOpacity onPress={() => setSelectedUser(chat)}>
  <Image source={{ uri: chat.avatar }} style={styles.chatAvatar} />
</TouchableOpacity>
<TouchableOpacity style={styles.chatItem} onPress={() => router.push('/screens/ChatDetailScreen')}>
              <View style={styles.chatText}>
                <Text style={styles.chatName}>{chat.name}</Text>
                <Text style={styles.chatLastMessage} numberOfLines={1}>
                  {chat.lastMessage}
                </Text>
              </View>
              <Text style={styles.chatTime}>{chat.time}</Text>
            </TouchableOpacity>
            </View>
          ))
        ) : (
          // empty state
          <View style={styles.centerContent}>
            <Text style={styles.title}>Start chatting</Text>
            <Text style={styles.subtitle}>
              Chat with your contacts or invite a friend to MoC.
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.avatarRow}
            >
              {dummyContacts.map((c, i) => (
                <View style={styles.avatarContainer} key={i}>
                  <Image source={{ uri: c.img }} style={styles.avatar} />
                  <Text style={styles.avatarName} numberOfLines={1}>
                    {c.name}
                  </Text>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.inviteButton}>
              <Text style={styles.inviteText}>Invite a friend</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab}  onPress={() => router.push('/screens/ListsScreen')}>
        <Icon name="playlist-add" size={20} color="#fff" />
        <Text style={styles.fabText}>create list</Text>
      </TouchableOpacity>
    </View>
  );
};

// Calls Screen
const CallsScreen = () => (
  <View style={styles.callsContainer}>
    <Text style={styles.title}>Your call history will appear here</Text>
  </View>
);

  const TopBar = () => {
    // header height (50) + safe‐area top
    
    return (
      <View
        style={[
          styles.topBar,
          searchActive && styles.topBarSearch,
          { paddingTop: insets.top },
        ]}
      >
        {searchActive ? (
           <>
          <TouchableOpacity onPress={() => { setSearchActive(false); setSearchQuery(''); hideMenu(); }}>
            <Icon name="arrow-back" size={22} color="#1f6ea7" />
          </TouchableOpacity>
          <TextInput
            style={styles.searchInput}
            placeholder="Search contacts"
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
        </>
        ) : (
          <>
            <Text style={styles.appName}>MoC</Text>
            <View style={styles.iconGroup}>
              <TouchableOpacity
                onPress={() => {
                  setSearchActive(true);
                  hideMenu();
                }}
              >
                <Icon name="search" size={22} color="#fff" style={styles.icon} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setMenuVisible(v => !v)}>
                <Icon name="more-vert" size={22} color="#fff" style={styles.icon} />
              </TouchableOpacity>
            </View>
          </>
        )}

        
      </View>
    );
  };

 const menuTop = insets.top + 50;


  const ProfileModal = () => {
  if (!selectedUser) return null;

  return (
    <View style={styles.modalOverlay}>
      {/* Pressable background to close modal */}
      <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedUser(null)} />

      {/* Modal content */}
      <View style={styles.modalContainer}>
        <TouchableOpacity style={styles.touchableImage}  activeOpacity={0.8} onPress={() =>
          router.push({ pathname: '/screens/ViewProfilePhoto', params: { uri: selectedUser.avatar } })
        }>
        <Image
          source={{ uri: selectedUser.avatar }}
          style={styles.modalFullImage}
          resizeMode="cover"
        />
        </TouchableOpacity>

        <View style={styles.modalActions}>
          <TouchableOpacity style={styles.modalIcon}><Icon name="message" size={24} color="#1f6ea7" /></TouchableOpacity>
          <TouchableOpacity style={styles.modalIcon}><Icon name="call" size={24} color="#1f6ea7" /></TouchableOpacity>
          <TouchableOpacity style={styles.modalIcon}><Icon name="videocam" size={24} color="#1f6ea7" /></TouchableOpacity>
          <TouchableOpacity style={styles.modalIcon}><Icon name="info" size={24} color="#1f6ea7" /></TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

 
  return (
  <View style={{ flex: 1 }}>
      <StatusBar
        backgroundColor={searchActive ? '#fff' : '#1f6ea7'}
        barStyle={searchActive ? 'dark-content' : 'light-content'}
      />

      <TopBar />

     {menuVisible && !searchActive && (
          <>
             <Pressable
            style={styles.menuOverlay}
            onPress={hideMenu}
          />
            <TouchableOpacity
              style={styles.menuOverlay}
              activeOpacity={1}
              onPress={hideMenu}
            />
            <View style={[styles.menuContainer, { top: menuTop }]}>
              
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => onMenuSelect('settings')}
              >
                <Text style={styles.menuLabel}>Settings</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      

      {!searchActive && (
        <Tab.Navigator
          screenOptions={{
            tabBarStyle: { backgroundColor: '#1f6ea7', elevation: 0 },
            tabBarLabelStyle: { fontWeight: 'bold', fontSize: 14 },
            tabBarActiveTintColor: '#fff',
            tabBarInactiveTintColor: '#d4d4d4',
            tabBarIndicatorStyle: { backgroundColor: '#fff', height: 3 },
          }}
        >
          <Tab.Screen name="Chats" component={ChatsScreen} />
          <Tab.Screen name="Calls" component={CallsScreen} />
        </Tab.Navigator>
      )}
      <ProfileModal />
    </View>
  );};

export default MocScreen;

const styles = StyleSheet.create({
  topBar: {
    height: 50,
    backgroundColor: '#1f6ea7',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    justifyContent: 'space-between',
  },
  topBarSearch: {
    backgroundColor: '#fff',
    justifyContent: 'flex-start',
  },
  appName: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  iconGroup: { flexDirection: 'row' },
  icon: { marginLeft: 16 },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#000',
  },

  // Chats wrapper
  chatsWrapper: { flex: 1, backgroundColor: '#f6f6f6' },
  chatListContainer: { paddingVertical: 8 },

  // Empty-state center
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginTop: windowHeight * 0.15,
  },

  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  subtitle: { textAlign: 'center', fontSize: 14, color: '#666', marginBottom: 24 },

  avatarRow: { flexDirection: 'row', marginBottom: 24 },
  avatarContainer: { alignItems: 'center', marginHorizontal: 10 },
  avatar: { width: 64, height: 64, borderRadius: 32, marginBottom: 4 },
  avatarName: { fontSize: 12, maxWidth: 70, textAlign: 'center' },

  inviteButton: {
    borderColor: '#1f6ea7',
    borderWidth: 1.5,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 24,
  },
  inviteText: { color: '#1f6ea7', fontWeight: '600', fontSize: 14 },

  // Chat list items
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef5fa',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#ccc',
  },
  chatAvatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  chatText: { flex: 1 },
  chatName: { fontWeight: 'bold', fontSize: 16, color: '#111' },
  chatLastMessage: { color: '#555', marginTop: 2, fontSize: 13 },
  chatTime: { fontSize: 12, color: '#777' },

  // Floating action button
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    backgroundColor: '#1f6ea7',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 30,
    elevation: 4,
  },
  fabText: { color: '#fff', fontWeight: 'bold', fontSize: 14, marginLeft: 6 },

   callsContainer: {
    flex: 1,
    backgroundColor: '#f6f6f6',
    alignItems: 'center',
    justifyContent: 'center',
  },

   menuOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
  menuContainer: {
    position: 'absolute',
    right: 16,
    width: 180,            // or '50%' as you prefer
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 5,
    zIndex: 1000,
    // no `top` here—it's injected via inline style
  },
 
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  menuLabel: {
    fontSize: 16,
    color: '#333',
  },

 modalOverlay: {
  ...StyleSheet.absoluteFillObject,
  backgroundColor: 'rgba(0,0,0,0.6)',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 2000,
},

modalContainer: {
  backgroundColor: '#fff',
  width: 300,
  borderRadius: 12,
  height: 300,
  overflow: 'hidden',
  elevation: 10,
},

touchableImage: {
    width: '100%',
    height: '80%',        // same as modalFullImage’s height
  },
  modalFullImage: {
    flex: 1,              // fill its parent
    width: undefined,     // allow flex to drive sizing
    height: undefined,
  },

modalActions: {
  flexDirection: 'row',
  justifyContent: 'space-around',
  paddingVertical: 10,
  paddingHorizontal: 10,
  backgroundColor: '#fff',
},

modalIcon: {
  padding: 10,
},
});