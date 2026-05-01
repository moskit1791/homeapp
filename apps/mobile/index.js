/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
const React = require('react');
const { AppRegistry, SafeAreaView, StyleSheet, Text, View } = require('react-native');

class EntryErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return <BootError error={this.state.error} />;
    }

    return this.props.children;
  }
}

function BootError({ error }) {
  const message = error instanceof Error ? error.message : 'Unknown startup error';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.card}>
        <Text style={styles.title}>Nie udalo sie uruchomic aplikacji</Text>
        <Text style={styles.message}>{message}</Text>
      </View>
    </SafeAreaView>
  );
}

function LazyRouterApp() {
  const RouterApp = require('expo-router/build/qualified-entry').App;

  return <RouterApp />;
}

function App() {
  return (
    <EntryErrorBoundary>
      <LazyRouterApp />
    </EntryErrorBoundary>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DFE3E8',
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    margin: 20,
    padding: 20
  },
  message: {
    color: '#637381',
    fontSize: 13,
    lineHeight: 19
  },
  safeArea: {
    backgroundColor: '#F4F6F8',
    flex: 1,
    justifyContent: 'center'
  },
  title: {
    color: '#212B36',
    fontSize: 18,
    fontWeight: '800'
  }
});

AppRegistry.registerComponent('main', () => App);
