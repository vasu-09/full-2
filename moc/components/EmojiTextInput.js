import React, { forwardRef, useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const extractMarginStyles = (style) => {
  if (!style) {
    return { marginStyle: null, withoutMargin: null };
  }

  const flattened = StyleSheet.flatten(style) || {};
  const marginKeys = [
    'margin',
    'marginTop',
    'marginRight',
    'marginBottom',
    'marginLeft',
    'marginHorizontal',
    'marginVertical',
  ];

  const marginStyle = {};
  const withoutMargin = { ...flattened };

  marginKeys.forEach((key) => {
    if (withoutMargin[key] != null) {
      marginStyle[key] = withoutMargin[key];
      delete withoutMargin[key];
    }
  });

  return { marginStyle, withoutMargin };
};

const EmojiTextInput = forwardRef(
  (
    {
      value,
      onChangeText,
      containerStyle,
      inputStyle,
      pickerStyle,
      onTogglePicker,
      onEmojiSelected,
      disabledEmojiPicker,
      iconColor = '#555',
      iconSize = 24,
      emojiSelectorHeight = 320,
      ...textInputProps
    },
    ref,
  ) => {
    const [isPickerVisible, setIsPickerVisible] = useState(false);
    const [activeCategoryId, setActiveCategoryId] = useState('smileys');
    const [recentEmojis, setRecentEmojis] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');

    const { marginStyle, withoutMargin } = useMemo(
      () => extractMarginStyles(containerStyle),
      [containerStyle],
    );

    const handleToggle = useCallback(() => {
      if (disabledEmojiPicker) {
        return;
      }

      setIsPickerVisible((current) => {
        const nextValue = !current;
        if (nextValue) {
          Keyboard.dismiss();
        }
        onTogglePicker?.(nextValue);
        return nextValue;
      });
    }, [disabledEmojiPicker, onTogglePicker]);

    const updateRecents = useCallback((emoji) => {
      setRecentEmojis((prev) => {
        const next = [emoji, ...prev.filter((item) => item.char !== emoji.char)];
        return next.slice(0, 30);
      });
    }, []);

    const handleEmojiSelected = useCallback(
      (emoji) => {
        const currentText = value ?? '';
        const nextText = `${currentText}${emoji.char}`;
        onChangeText?.(nextText);
        onEmojiSelected?.(emoji, nextText);
        updateRecents(emoji);
      },
      [onChangeText, onEmojiSelected, updateRecents, value],
    );

    const closePicker = useCallback(() => {
      setIsPickerVisible(false);
      onTogglePicker?.(false);
    }, [onTogglePicker]);

    const handleEmojiPress = useCallback(
      (emoji) => {
        handleEmojiSelected(emoji);
        closePicker();
      },
      [closePicker, handleEmojiSelected],
    );

    const allEmojis = useMemo(() => EMOJI_CATEGORIES.flatMap((category) => category.emojis), []);

    const displayedEmojis = useMemo(() => {
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        return allEmojis.filter((emoji) =>
          emoji.name.toLowerCase().includes(query) ||
          emoji.keywords.some((keyword) => keyword.includes(query)),
        );
      }

      if (activeCategoryId === 'recents') {
        return recentEmojis;
      }

      const category = EMOJI_CATEGORIES.find((item) => item.id === activeCategoryId);
      return category ? category.emojis : [];
    }, [activeCategoryId, allEmojis, recentEmojis, searchQuery]);

    const renderEmoji = useCallback(
      ({ item }) => (
        <TouchableOpacity
          style={styles.emojiButtonTile}
          onPress={() => handleEmojiPress(item)}
          accessibilityLabel={item.name}
        >
          <Text style={styles.emoji}>{item.char}</Text>
        </TouchableOpacity>
      ),
      [handleEmojiPress],
    );

    const keyExtractor = useCallback((item) => item.char, []);

    const hasNoResults = displayedEmojis.length === 0;

    return (
      <View style={[styles.block, marginStyle]}>
        <View
          style={[
            styles.inputWrapper,
            withoutMargin,
            textInputProps.multiline ? styles.inputWrapperMultiline : null,
            disabledEmojiPicker ? styles.inputWrapperDisabled : null,
          ]}
        >
          <TextInput
            ref={ref}
            value={value}
            onChangeText={onChangeText}
            style={[
              styles.input,
              inputStyle,
              disabledEmojiPicker ? styles.inputWithoutEmoji : null,
              disabledEmojiPicker ? styles.inputDisabled : null,
            ]}
            {...textInputProps}
          />
          {!disabledEmojiPicker ? (
            <TouchableOpacity
              onPress={handleToggle}
              accessibilityLabel={isPickerVisible ? 'Hide emoji keyboard' : 'Show emoji keyboard'}
              accessibilityRole="button"
              style={[
                styles.iconButton,
                textInputProps.multiline ? styles.iconButtonMultiline : null,
              ]}
            >
              <Ionicons
                name={isPickerVisible ? 'keyboard-outline' : 'happy-outline'}
                size={iconSize}
                color={iconColor}
              />
            </TouchableOpacity>
          ) : null}
        </View>

        {isPickerVisible ? (
          <View style={[styles.pickerContainer, { height: emojiSelectorHeight }, pickerStyle]}>
            <View style={styles.pickerHeader}>
              <View style={styles.searchContainer}>
                <Ionicons name="search-outline" size={18} color="#666" />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search emojis"
                  placeholderTextColor="#888"
                  style={styles.searchInput}
                  returnKeyType="search"
                />
              </View>
              <View style={styles.categoryTabs}>
                <TouchableOpacity
                  key="recents"
                  style={[styles.categoryTab, activeCategoryId === 'recents' ? styles.categoryTabActive : null]}
                  onPress={() => setActiveCategoryId('recents')}
                  accessibilityLabel="Recent emojis"
                >
                  <Ionicons name="time-outline" size={20} color={activeCategoryId === 'recents' ? '#1f6ea7' : '#666'} />
                </TouchableOpacity>
                {EMOJI_CATEGORIES.map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.categoryTab,
                      activeCategoryId === category.id ? styles.categoryTabActive : null,
                    ]}
                    onPress={() => {
                      setActiveCategoryId(category.id);
                      setSearchQuery('');
                    }}
                    accessibilityLabel={category.label}
                  >
                    {category.iconLibrary === 'Ionicons' ? (
                      <Ionicons
                        name={category.icon}
                        size={20}
                        color={activeCategoryId === category.id ? '#1f6ea7' : '#666'}
                      />
                    ) : (
                      <MaterialCommunityIcons
                        name={category.icon}
                        size={20}
                        color={activeCategoryId === category.id ? '#1f6ea7' : '#666'}
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.pickerContent}>
              {hasNoResults ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>
                    {searchQuery.trim()
                      ? 'No emojis match your search yet.'
                      : 'Your recently used emojis will appear here.'}
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={displayedEmojis}
                  renderItem={renderEmoji}
                  keyExtractor={keyExtractor}
                  numColumns={8}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.emojiGrid}
                />
              )}
            </View>
          </View>
        ) : null}
      </View>
    );
  },
);

const EMOJI_CATEGORIES = [
  {
    id: 'smileys',
    label: 'Smileys & People',
    icon: 'happy-outline',
    iconLibrary: 'Ionicons',
    emojis: [
      { char: '😀', name: 'Grinning face', keywords: ['grin', 'happy', 'smile'] },
      { char: '😁', name: 'Beaming face', keywords: ['grin', 'happy', 'smile'] },
      { char: '😂', name: 'Face with tears of joy', keywords: ['joy', 'tears', 'laugh'] },
      { char: '🤣', name: 'Rolling on the floor laughing', keywords: ['lol', 'rolling', 'laugh'] },
      { char: '😃', name: 'Smiling face with big eyes', keywords: ['smile', 'happy', 'big'] },
      { char: '😄', name: 'Smiling face with smiling eyes', keywords: ['happy', 'smile'] },
      { char: '😅', name: 'Smiling face with sweat', keywords: ['sweat', 'relief', 'smile'] },
      { char: '😊', name: 'Smiling face with smiling eyes', keywords: ['blush', 'smile', 'happy'] },
      { char: '😇', name: 'Smiling face with halo', keywords: ['angel', 'innocent'] },
      { char: '🙂', name: 'Slightly smiling face', keywords: ['smile', 'slight'] },
      { char: '🙃', name: 'Upside-down face', keywords: ['silly', 'upside-down'] },
      { char: '😉', name: 'Winking face', keywords: ['wink', 'flirt'] },
      { char: '😍', name: 'Smiling face with heart-eyes', keywords: ['love', 'heart', 'smile'] },
      { char: '😘', name: 'Face blowing a kiss', keywords: ['kiss', 'love'] },
      { char: '😗', name: 'Kissing face', keywords: ['kiss', 'smile'] },
      { char: '😙', name: 'Kissing face with smiling eyes', keywords: ['smile', 'kiss'] },
      { char: '😚', name: 'Kissing face with closed eyes', keywords: ['kiss', 'smile'] },
      { char: '😋', name: 'Face savoring food', keywords: ['yum', 'delicious'] },
      { char: '😛', name: 'Face with tongue', keywords: ['tongue', 'playful'] },
      { char: '😜', name: 'Winking face with tongue', keywords: ['wink', 'tongue'] },
      { char: '🤪', name: 'Zany face', keywords: ['crazy', 'goofy'] },
      { char: '😝', name: 'Squinting face with tongue', keywords: ['tongue', 'playful'] },
      { char: '🤑', name: 'Money-mouth face', keywords: ['money', 'rich'] },
      { char: '🤗', name: 'Hugging face', keywords: ['hug', 'smile'] },
      { char: '🤭', name: 'Face with hand over mouth', keywords: ['oops', 'giggle'] },
      { char: '🤫', name: 'Shushing face', keywords: ['quiet', 'shh'] },
      { char: '🤔', name: 'Thinking face', keywords: ['think', 'hmm'] },
      { char: '🤐', name: 'Zipper-mouth face', keywords: ['zipper', 'silence'] },
      { char: '😐', name: 'Neutral face', keywords: ['meh', 'neutral'] },
      { char: '😑', name: 'Expressionless face', keywords: ['expressionless', 'blank'] },
    ],
  },
  {
    id: 'animals',
    label: 'Animals & Nature',
    icon: 'paw-outline',
    iconLibrary: 'Ionicons',
    emojis: [
      { char: '🐶', name: 'Dog face', keywords: ['dog', 'pet'] },
      { char: '🐱', name: 'Cat face', keywords: ['cat', 'pet'] },
      { char: '🐭', name: 'Mouse face', keywords: ['mouse'] },
      { char: '🐹', name: 'Hamster face', keywords: ['hamster', 'pet'] },
      { char: '🐰', name: 'Rabbit face', keywords: ['rabbit', 'bunny'] },
      { char: '🦊', name: 'Fox face', keywords: ['fox'] },
      { char: '🐻', name: 'Bear face', keywords: ['bear'] },
      { char: '🐼', name: 'Panda face', keywords: ['panda', 'bear'] },
      { char: '🐻‍❄️', name: 'Polar bear', keywords: ['polar', 'bear'] },
      { char: '🐨', name: 'Koala', keywords: ['koala'] },
      { char: '🐯', name: 'Tiger face', keywords: ['tiger'] },
      { char: '🦁', name: 'Lion face', keywords: ['lion'] },
      { char: '🐮', name: 'Cow face', keywords: ['cow'] },
      { char: '🐷', name: 'Pig face', keywords: ['pig'] },
      { char: '🐸', name: 'Frog face', keywords: ['frog'] },
      { char: '🐵', name: 'Monkey face', keywords: ['monkey'] },
      { char: '🙈', name: 'See-no-evil monkey', keywords: ['monkey', 'see no evil'] },
      { char: '🙉', name: 'Hear-no-evil monkey', keywords: ['monkey', 'hear no evil'] },
      { char: '🙊', name: 'Speak-no-evil monkey', keywords: ['monkey', 'speak no evil'] },
      { char: '🐒', name: 'Monkey', keywords: ['monkey'] },
      { char: '🦍', name: 'Gorilla', keywords: ['gorilla'] },
      { char: '🦧', name: 'Orangutan', keywords: ['orangutan'] },
      { char: '🐔', name: 'Chicken', keywords: ['chicken'] },
      { char: '🐧', name: 'Penguin', keywords: ['penguin'] },
      { char: '🐦', name: 'Bird', keywords: ['bird'] },
      { char: '🐤', name: 'Baby chick', keywords: ['chick'] },
      { char: '🦆', name: 'Duck', keywords: ['duck'] },
      { char: '🐙', name: 'Octopus', keywords: ['octopus'] },
      { char: '🦑', name: 'Squid', keywords: ['squid'] },
      { char: '🌲', name: 'Evergreen tree', keywords: ['tree', 'nature'] },
      { char: '🌳', name: 'Deciduous tree', keywords: ['tree', 'nature'] },
    ],
  },
  {
    id: 'food',
    label: 'Food & Drink',
    icon: 'pizza',
    iconLibrary: 'MaterialCommunityIcons',
    emojis: [
      { char: '🍎', name: 'Red apple', keywords: ['apple', 'fruit'] },
      { char: '🍇', name: 'Grapes', keywords: ['grapes', 'fruit'] },
      { char: '🍉', name: 'Watermelon', keywords: ['watermelon', 'fruit'] },
      { char: '🍌', name: 'Banana', keywords: ['banana', 'fruit'] },
      { char: '🍍', name: 'Pineapple', keywords: ['pineapple', 'fruit'] },
      { char: '🥭', name: 'Mango', keywords: ['mango', 'fruit'] },
      { char: '🍑', name: 'Peach', keywords: ['peach', 'fruit'] },
      { char: '🍒', name: 'Cherries', keywords: ['cherry', 'fruit'] },
      { char: '🍓', name: 'Strawberry', keywords: ['strawberry', 'fruit'] },
      { char: '🥝', name: 'Kiwi fruit', keywords: ['kiwi', 'fruit'] },
      { char: '🍅', name: 'Tomato', keywords: ['tomato'] },
      { char: '🥑', name: 'Avocado', keywords: ['avocado'] },
      { char: '🍆', name: 'Eggplant', keywords: ['eggplant'] },
      { char: '🥔', name: 'Potato', keywords: ['potato'] },
      { char: '🥕', name: 'Carrot', keywords: ['carrot'] },
      { char: '🌽', name: 'Ear of corn', keywords: ['corn'] },
      { char: '🌶️', name: 'Hot pepper', keywords: ['spicy', 'pepper'] },
      { char: '🍞', name: 'Bread', keywords: ['bread', 'food'] },
      { char: '🥐', name: 'Croissant', keywords: ['croissant'] },
      { char: '🥯', name: 'Bagel', keywords: ['bagel'] },
      { char: '🥞', name: 'Pancakes', keywords: ['pancakes'] },
      { char: '🧇', name: 'Waffle', keywords: ['waffle'] },
      { char: '🧀', name: 'Cheese wedge', keywords: ['cheese'] },
      { char: '🍗', name: 'Poultry leg', keywords: ['chicken', 'leg'] },
      { char: '🍔', name: 'Hamburger', keywords: ['burger'] },
      { char: '🍟', name: 'French fries', keywords: ['fries'] },
      { char: '🍕', name: 'Pizza', keywords: ['pizza'] },
      { char: '🌮', name: 'Taco', keywords: ['taco'] },
      { char: '🌯', name: 'Burrito', keywords: ['burrito'] },
      { char: '🥪', name: 'Sandwich', keywords: ['sandwich'] },
      { char: '🥣', name: 'Bowl with spoon', keywords: ['bowl', 'soup'] },
    ],
  },
  {
    id: 'activity',
    label: 'Activity',
    icon: 'basketball-outline',
    iconLibrary: 'Ionicons',
    emojis: [
      { char: '⚽', name: 'Soccer ball', keywords: ['soccer', 'football'] },
      { char: '🏀', name: 'Basketball', keywords: ['basketball'] },
      { char: '🏈', name: 'American football', keywords: ['football'] },
      { char: '⚾', name: 'Baseball', keywords: ['baseball'] },
      { char: '🥎', name: 'Softball', keywords: ['softball'] },
      { char: '🎾', name: 'Tennis', keywords: ['tennis'] },
      { char: '🏐', name: 'Volleyball', keywords: ['volleyball'] },
      { char: '🏉', name: 'Rugby football', keywords: ['rugby'] },
      { char: '🥏', name: 'Flying disc', keywords: ['frisbee'] },
      { char: '🎱', name: 'Pool 8 ball', keywords: ['billiards'] },
      { char: '🏓', name: 'Ping pong', keywords: ['table tennis'] },
      { char: '🏸', name: 'Badminton', keywords: ['badminton'] },
      { char: '🥊', name: 'Boxing glove', keywords: ['boxing'] },
      { char: '🥋', name: 'Martial arts uniform', keywords: ['martial arts'] },
      { char: '🥅', name: 'Goal net', keywords: ['goal'] },
      { char: '⛳', name: 'Flag in hole', keywords: ['golf'] },
      { char: '🏌️', name: 'Person golfing', keywords: ['golf'] },
      { char: '🏇', name: 'Horse racing', keywords: ['horse'] },
      { char: '🚴', name: 'Person biking', keywords: ['biking'] },
      { char: '🏊', name: 'Person swimming', keywords: ['swimming'] },
      { char: '🤽', name: 'Person playing water polo', keywords: ['water polo'] },
      { char: '🤾', name: 'Person playing handball', keywords: ['handball'] },
      { char: '⛷️', name: 'Skier', keywords: ['ski'] },
      { char: '🏂', name: 'Snowboarder', keywords: ['snowboard'] },
      { char: '🪂', name: 'Parachute', keywords: ['parachute'] },
      { char: '🧗', name: 'Person climbing', keywords: ['climb'] },
      { char: '🏋️', name: 'Person lifting weights', keywords: ['weights'] },
      { char: '🤸', name: 'Person cartwheeling', keywords: ['gymnastics'] },
      { char: '🤹', name: 'Person juggling', keywords: ['juggle'] },
      { char: '🧘', name: 'Person in lotus position', keywords: ['yoga'] },
    ],
  },
  {
    id: 'travel',
    label: 'Travel & Places',
    icon: 'car-outline',
    iconLibrary: 'Ionicons',
    emojis: [
      { char: '🚗', name: 'Car', keywords: ['car', 'drive'] },
      { char: '🚕', name: 'Taxi', keywords: ['taxi'] },
      { char: '🚙', name: 'Sport utility vehicle', keywords: ['suv'] },
      { char: '🚌', name: 'Bus', keywords: ['bus'] },
      { char: '🚎', name: 'Trolleybus', keywords: ['trolley'] },
      { char: '🏎️', name: 'Racing car', keywords: ['race', 'car'] },
      { char: '🚓', name: 'Police car', keywords: ['police', 'car'] },
      { char: '🚑', name: 'Ambulance', keywords: ['ambulance'] },
      { char: '🚒', name: 'Fire engine', keywords: ['fire truck'] },
      { char: '🚐', name: 'Minibus', keywords: ['van'] },
      { char: '🛻', name: 'Pickup truck', keywords: ['truck'] },
      { char: '🚚', name: 'Delivery truck', keywords: ['truck'] },
      { char: '🚛', name: 'Articulated lorry', keywords: ['lorry', 'truck'] },
      { char: '🚜', name: 'Tractor', keywords: ['tractor'] },
      { char: '🏍️', name: 'Motorcycle', keywords: ['motorcycle'] },
      { char: '🛵', name: 'Motor scooter', keywords: ['scooter'] },
      { char: '🚲', name: 'Bicycle', keywords: ['bike'] },
      { char: '🛴', name: 'Kick scooter', keywords: ['scooter'] },
      { char: '🚨', name: 'Police car light', keywords: ['siren'] },
      { char: '🚥', name: 'Horizontal traffic light', keywords: ['traffic'] },
      { char: '🛑', name: 'Stop sign', keywords: ['stop'] },
      { char: '🚧', name: 'Construction', keywords: ['construction'] },
      { char: '⛽', name: 'Fuel pump', keywords: ['fuel'] },
      { char: '🛢️', name: 'Oil drum', keywords: ['oil'] },
      { char: '🗺️', name: 'World map', keywords: ['map'] },
      { char: '🗽', name: 'Statue of Liberty', keywords: ['statue', 'liberty'] },
      { char: '🗼', name: 'Tokyo tower', keywords: ['tower'] },
      { char: '🏰', name: 'Castle', keywords: ['castle'] },
      { char: '🗻', name: 'Mount fuji', keywords: ['mountain'] },
      { char: '🏝️', name: 'Desert island', keywords: ['island'] },
    ],
  },
  {
    id: 'objects',
    label: 'Objects',
    icon: 'cube-outline',
    iconLibrary: 'Ionicons',
    emojis: [
      { char: '⌚', name: 'Watch', keywords: ['watch'] },
      { char: '📱', name: 'Mobile phone', keywords: ['phone'] },
      { char: '💻', name: 'Laptop', keywords: ['laptop', 'computer'] },
      { char: '🖥️', name: 'Desktop computer', keywords: ['computer'] },
      { char: '🖨️', name: 'Printer', keywords: ['printer'] },
      { char: '🖱️', name: 'Computer mouse', keywords: ['mouse'] },
      { char: '💽', name: 'Computer disk', keywords: ['disk'] },
      { char: '💾', name: 'Floppy disk', keywords: ['floppy'] },
      { char: '📷', name: 'Camera', keywords: ['camera'] },
      { char: '📹', name: 'Video camera', keywords: ['video'] },
      { char: '🎥', name: 'Movie camera', keywords: ['movie'] },
      { char: '📼', name: 'Videocassette', keywords: ['cassette'] },
      { char: '📺', name: 'Television', keywords: ['tv'] },
      { char: '📻', name: 'Radio', keywords: ['radio'] },
      { char: '📟', name: 'Pager', keywords: ['pager'] },
      { char: '📠', name: 'Fax machine', keywords: ['fax'] },
      { char: '☎️', name: 'Telephone', keywords: ['phone'] },
      { char: '📞', name: 'Telephone receiver', keywords: ['phone'] },
      { char: '📀', name: 'DVD', keywords: ['dvd'] },
      { char: '💡', name: 'Light bulb', keywords: ['idea', 'bulb'] },
      { char: '🔦', name: 'Flashlight', keywords: ['flashlight'] },
      { char: '🏮', name: 'Red lantern', keywords: ['lantern'] },
      { char: '📔', name: 'Notebook with decorative cover', keywords: ['notebook'] },
      { char: '📒', name: 'Ledger', keywords: ['ledger'] },
      { char: '📕', name: 'Closed book', keywords: ['book'] },
      { char: '📗', name: 'Green book', keywords: ['book'] },
      { char: '📘', name: 'Blue book', keywords: ['book'] },
      { char: '📙', name: 'Orange book', keywords: ['book'] },
      { char: '📚', name: 'Books', keywords: ['books'] },
      { char: '📰', name: 'Newspaper', keywords: ['news'] },
    ],
  },
  {
    id: 'symbols',
    label: 'Symbols',
    icon: 'heart-outline',
    iconLibrary: 'Ionicons',
    emojis: [
      { char: '❤️', name: 'Red heart', keywords: ['heart', 'love'] },
      { char: '🧡', name: 'Orange heart', keywords: ['heart', 'orange'] },
      { char: '💛', name: 'Yellow heart', keywords: ['heart', 'yellow'] },
      { char: '💚', name: 'Green heart', keywords: ['heart', 'green'] },
      { char: '💙', name: 'Blue heart', keywords: ['heart', 'blue'] },
      { char: '💜', name: 'Purple heart', keywords: ['heart', 'purple'] },
      { char: '🤎', name: 'Brown heart', keywords: ['heart', 'brown'] },
      { char: '🖤', name: 'Black heart', keywords: ['heart', 'black'] },
      { char: '🤍', name: 'White heart', keywords: ['heart', 'white'] },
      { char: '💔', name: 'Broken heart', keywords: ['heartbreak'] },
      { char: '❤️‍🔥', name: 'Heart on fire', keywords: ['heart', 'fire'] },
      { char: '❤️‍🩹', name: 'Mending heart', keywords: ['heart', 'heal'] },
      { char: '❣️', name: 'Heart exclamation', keywords: ['heart', 'exclamation'] },
      { char: '💕', name: 'Two hearts', keywords: ['hearts', 'love'] },
      { char: '💞', name: 'Revolving hearts', keywords: ['hearts'] },
      { char: '💓', name: 'Beating heart', keywords: ['heart'] },
      { char: '💗', name: 'Growing heart', keywords: ['heart'] },
      { char: '💖', name: 'Sparkling heart', keywords: ['heart', 'sparkle'] },
      { char: '💘', name: 'Heart with arrow', keywords: ['heart', 'arrow'] },
      { char: '💝', name: 'Heart with ribbon', keywords: ['heart', 'gift'] },
      { char: '💟', name: 'Heart decoration', keywords: ['heart', 'decoration'] },
      { char: '☮️', name: 'Peace symbol', keywords: ['peace'] },
      { char: '✝️', name: 'Latin cross', keywords: ['cross'] },
      { char: '☪️', name: 'Star and crescent', keywords: ['star', 'crescent'] },
      { char: '☯️', name: 'Yin yang', keywords: ['yin', 'yang'] },
      { char: '🕉️', name: 'Om', keywords: ['om'] },
      { char: '☸️', name: 'Wheel of dharma', keywords: ['dharma'] },
      { char: '✡️', name: 'Star of David', keywords: ['star'] },
      { char: '🔯', name: 'Six pointed star with dot', keywords: ['star'] },
      { char: '🕎', name: 'Menorah', keywords: ['menorah'] },
    ],
  },
  {
    id: 'flags',
    label: 'Flags',
    icon: 'flag-outline',
    iconLibrary: 'Ionicons',
    emojis: [
      { char: '🏳️', name: 'White flag', keywords: ['flag', 'white'] },
      { char: '🏴', name: 'Black flag', keywords: ['flag', 'black'] },
      { char: '🏁', name: 'Chequered flag', keywords: ['flag', 'chequered'] },
      { char: '🚩', name: 'Triangular flag', keywords: ['flag', 'triangular'] },
      { char: '🏳️‍🌈', name: 'Rainbow flag', keywords: ['flag', 'rainbow'] },
      { char: '🏳️‍⚧️', name: 'Transgender flag', keywords: ['flag', 'transgender'] },
      { char: '🇮🇳', name: 'Flag: India', keywords: ['flag', 'india'] },
      { char: '🇺🇳', name: 'Flag: United Nations', keywords: ['flag', 'united nations'] },
      { char: '🇵🇹', name: 'Flag: Portugal', keywords: ['flag', 'portugal'] },
      { char: '🇳🇴', name: 'Flag: Norway', keywords: ['flag', 'norway'] },
      { char: '🇮🇸', name: 'Flag: Iceland', keywords: ['flag', 'iceland'] },
      { char: '🇦🇱', name: 'Flag: Albania', keywords: ['flag', 'albania'] },
      { char: '🇩🇿', name: 'Flag: Algeria', keywords: ['flag', 'algeria'] },
      { char: '🇦🇴', name: 'Flag: Angola', keywords: ['flag', 'angola'] },
      { char: '🇦🇷', name: 'Flag: Argentina', keywords: ['flag', 'argentina'] },
      { char: '🇦🇺', name: 'Flag: Australia', keywords: ['flag', 'australia'] },
      { char: '🇦🇹', name: 'Flag: Austria', keywords: ['flag', 'austria'] },
      { char: '🇦🇿', name: 'Flag: Azerbaijan', keywords: ['flag', 'azerbaijan'] },
      { char: '🇧🇭', name: 'Flag: Bahrain', keywords: ['flag', 'bahrain'] },
      { char: '🇧🇩', name: 'Flag: Bangladesh', keywords: ['flag', 'bangladesh'] },
      { char: '🇧🇧', name: 'Flag: Barbados', keywords: ['flag', 'barbados'] },
      { char: '🇧🇪', name: 'Flag: Belgium', keywords: ['flag', 'belgium'] },
      { char: '🇧🇴', name: 'Flag: Bolivia', keywords: ['flag', 'bolivia'] },
      { char: '🇧🇷', name: 'Flag: Brazil', keywords: ['flag', 'brazil'] },
      { char: '🇨🇦', name: 'Flag: Canada', keywords: ['flag', 'canada'] },
      { char: '🇨🇳', name: 'Flag: China', keywords: ['flag', 'china'] },
      { char: '🇫🇷', name: 'Flag: France', keywords: ['flag', 'france'] },
      { char: '🇩🇪', name: 'Flag: Germany', keywords: ['flag', 'germany'] },
      { char: '🇯🇵', name: 'Flag: Japan', keywords: ['flag', 'japan'] },
      { char: '🇺🇸', name: 'Flag: United States', keywords: ['flag', 'usa'] },
    ],
  },
];

const styles = StyleSheet.create({
  block: {
    width: '100%',
  },
  inputWrapper: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 10,
    paddingLeft: 12,
    backgroundColor: '#fff',
  },
  inputWrapperMultiline: {
    alignItems: 'flex-start',
    paddingTop: 12,
  },
  inputWrapperDisabled: {
    opacity: 0.6,
  },
  input: {
    flex: 1,
    minHeight: 44,
    fontSize: 16,
    color: '#000',
    paddingRight: 44,
  },
  inputWithoutEmoji: {
    paddingRight: 16,
  },
  inputDisabled: {
    color: '#999',
  },
  iconButton: {
    position: 'absolute',
    right: 8,
    top: '50%',
    marginLeft: 8,
    transform: [{ translateY: -18 }],
    padding: 6,
  },
  iconButtonMultiline: {
    top: undefined,
    bottom: 10,
    transform: undefined,
  },
  pickerContainer: {
    marginTop: 12,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#d0d0d0',
    backgroundColor: '#fff',
  },
  pickerHeader: {
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f1f1',
    paddingHorizontal: 10,
    borderRadius: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#000',
  },
  categoryTabs: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 6,
  },
  categoryTab: {
    padding: 8,
    borderRadius: 20,
  },
  categoryTabActive: {
    backgroundColor: '#e1effa',
  },
  pickerContent: {
    flex: 1,
    paddingHorizontal: 8,
    paddingBottom: 12,
  },
  emojiGrid: {
    paddingTop: 8,
  },
  emojiButtonTile: {
    width: '12.5%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    marginVertical: 6,
  },
  emoji: {
    fontSize: 28,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});

EmojiTextInput.displayName = 'EmojiTextInput';

export default EmojiTextInput;