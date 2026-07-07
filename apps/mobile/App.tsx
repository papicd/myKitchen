import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type Screen = 'home' | 'recipes' | 'find' | 'add' | 'profile' | 'login' | 'signup';

type User = {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  isAdmin: boolean;
};

type RecipeListItem = {
  id: string;
  title: string;
  shortDescription: string;
  ingredients: string[];
  preparationTime: string;
  servings: string;
  matchedGroceries?: number;
};

type RecipeDetails = RecipeListItem & {
  description: string;
  steps: string[];
  createdBy: string;
};

const API_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:4000/api' : 'http://localhost:4000/api';

async function request<T>(path: string, token?: string | null, body?: unknown) {
  const response = await fetch(`${API_URL}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message ?? 'Zahtev nije uspeo');
  }

  return data as T;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [recipes, setRecipes] = useState<RecipeListItem[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeDetails | null>(null);
  const [message, setMessage] = useState('');

  const isLoggedIn = Boolean(token && user);

  useEffect(() => {
    request<RecipeListItem[]>('/recipes')
      .then(setRecipes)
      .catch(() => setMessage('Recepti trenutno nisu dostupni.'));
  }, []);

  async function login(email: string, password: string) {
    const auth = await request<{ token: string; user: User }>('/auth/login', null, {
      email,
      password,
    });
    setToken(auth.token);
    setUser(auth.user);
    setMessage('Uspesno ste prijavljeni.');
    setScreen('home');
  }

  async function signup(input: {
    firstName: string;
    lastName: string;
    username: string;
    email: string;
    password: string;
  }) {
    const auth = await request<{ token: string; user: User }>('/auth/register', null, input);
    setToken(auth.token);
    setUser(auth.user);
    setMessage('Nalog je kreiran.');
    setScreen('home');
  }

  function logout() {
    setToken(null);
    setUser(null);
    setSelectedRecipe(null);
    setMessage('Odjavljeni ste.');
    setScreen('home');
  }

  async function openRecipe(id: string) {
    if (!token) {
      setMessage('Detalji recepta su dostupni nakon prijave.');
      setScreen('login');
      return;
    }

    setSelectedRecipe(await request<RecipeDetails>(`/recipes/${id}`, token));
  }

  async function search(query: string) {
    if (!token) {
      setScreen('login');
      return;
    }

    setRecipes(
      await request<RecipeListItem[]>(
        `/recipes/search?q=${encodeURIComponent(query)}`,
        token,
      ),
    );
  }

  async function addRecipe(recipe: {
    title: string;
    shortDescription: string;
    description: string;
    ingredients: string[];
    steps: string[];
    preparationTime: string;
    servings: string;
  }) {
    if (!token) {
      setScreen('login');
      return;
    }

    await request<RecipeDetails>('/recipes', token, recipe);
    setMessage('Recept je sacuvan.');
    setRecipes(await request<RecipeListItem[]>('/recipes'));
    setScreen('profile');
  }

  return (
    <View style={styles.app}>
      <StatusBar style="dark" />
      <View style={styles.topbar}>
        <Text style={styles.logo}>Moja Kuhinja</Text>
        <View style={styles.nav}>
          <NavButton label="Pocetna" onPress={() => setScreen('home')} />
          <NavButton label="Recepti" onPress={() => setScreen('recipes')} />
          {isLoggedIn ? <NavButton label="Pronadji" onPress={() => setScreen('find')} /> : null}
          {isLoggedIn ? <NavButton label="Dodaj" onPress={() => setScreen('add')} /> : null}
        </View>
        <View style={styles.nav}>
          {isLoggedIn ? (
            <>
              <NavButton label="Profil" onPress={() => setScreen('profile')} />
              <NavButton label="Odjava" onPress={logout} />
            </>
          ) : (
            <>
              <NavButton label="Prijava" onPress={() => setScreen('login')} />
              <NavButton label="Registracija" onPress={() => setScreen('signup')} />
            </>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {message ? <Text style={styles.message}>{message}</Text> : null}
        {selectedRecipe ? (
          <RecipeDetailsView recipe={selectedRecipe} onBack={() => setSelectedRecipe(null)} />
        ) : screen === 'home' ? (
          <Home />
        ) : screen === 'recipes' ? (
          <Recipes recipes={recipes} onOpen={openRecipe} />
        ) : screen === 'find' ? (
          <Find onSearch={search} recipes={recipes} onOpen={openRecipe} />
        ) : screen === 'add' ? (
          <AddRecipe onAdd={addRecipe} />
        ) : screen === 'profile' ? (
          <Profile user={user} token={token} onOpen={openRecipe} />
        ) : screen === 'login' ? (
          <Login onLogin={login} />
        ) : (
          <Signup onSignup={signup} />
        )}
      </ScrollView>
    </View>
  );
}

function NavButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.navButton} onPress={onPress}>
      <Text style={styles.navText}>{label}</Text>
    </Pressable>
  );
}

function Home() {
  return (
    <View>
      <Text style={styles.title}>Kuvaj ono sto vec imas.</Text>
      <Text style={styles.paragraph}>
        Pregledaj domace recepte, dodaj svoje ideje i pronadji jelo prema
        namirnicama koje su ti pri ruci.
      </Text>
    </View>
  );
}

function Recipes({
  recipes,
  onOpen,
}: {
  recipes: RecipeListItem[];
  onOpen: (id: string) => void;
}) {
  return (
    <View style={styles.grid}>
      {recipes.map((recipe) => (
        <Pressable key={recipe.id} style={styles.card} onPress={() => onOpen(recipe.id)}>
          <Text style={styles.cardTitle}>{recipe.title}</Text>
          <Text style={styles.paragraph}>{recipe.shortDescription}</Text>
          <Text style={styles.meta}>
            {recipe.preparationTime} - {recipe.servings}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function RecipeDetailsView({
  recipe,
  onBack,
}: {
  recipe: RecipeDetails;
  onBack: () => void;
}) {
  return (
    <View>
      <NavButton label="Nazad" onPress={onBack} />
      <Text style={styles.title}>{recipe.title}</Text>
      <Text style={styles.paragraph}>{recipe.description}</Text>
      <Text style={styles.sectionTitle}>Sastojci</Text>
      {recipe.ingredients.map((ingredient) => (
        <Text key={ingredient} style={styles.paragraph}>
          - {ingredient}
        </Text>
      ))}
      <Text style={styles.sectionTitle}>Priprema</Text>
      {recipe.steps.map((step, index) => (
        <Text key={step} style={styles.paragraph}>
          {index + 1}. {step}
        </Text>
      ))}
    </View>
  );
}

function Login({ onLogin }: { onLogin: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState('a@a.a');
  const [password, setPassword] = useState('12');
  const [error, setError] = useState('');

  async function submit() {
    setError('');
    try {
      await onLogin(email, password);
    } catch {
      setError('Prijava nije uspela.');
    }
  }

  return (
    <View style={styles.form}>
      <Text style={styles.title}>Prijava</Text>
      <Input label="Email" value={email} onChangeText={setEmail} />
      <Input label="Lozinka" value={password} onChangeText={setPassword} secureTextEntry />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <NavButton label="Prijavi se" onPress={submit} />
    </View>
  );
}

function Signup({
  onSignup,
}: {
  onSignup: (input: {
    firstName: string;
    lastName: string;
    username: string;
    email: string;
    password: string;
  }) => Promise<void>;
}) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function submit() {
    setError('');
    try {
      await onSignup({ firstName, lastName, username, email, password });
    } catch {
      setError('Registracija nije uspela.');
    }
  }

  return (
    <View style={styles.form}>
      <Text style={styles.title}>Registracija</Text>
      <Input label="Ime" value={firstName} onChangeText={setFirstName} />
      <Input label="Prezime" value={lastName} onChangeText={setLastName} />
      <Input label="Korisnicko ime" value={username} onChangeText={setUsername} />
      <Input label="Email" value={email} onChangeText={setEmail} />
      <Input label="Lozinka" value={password} onChangeText={setPassword} secureTextEntry />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <NavButton label="Registruj se" onPress={submit} />
    </View>
  );
}

function Find({
  onSearch,
  recipes,
  onOpen,
}: {
  onSearch: (query: string) => Promise<void>;
  recipes: RecipeListItem[];
  onOpen: (id: string) => void;
}) {
  const [query, setQuery] = useState('');

  return (
    <View>
      <Text style={styles.title}>Pronadji jelo</Text>
      <Input label="Namirnice" value={query} onChangeText={setQuery} />
      <NavButton label="Pretrazi" onPress={() => onSearch(query)} />
      <Recipes recipes={recipes} onOpen={onOpen} />
    </View>
  );
}

function AddRecipe({
  onAdd,
}: {
  onAdd: (recipe: {
    title: string;
    shortDescription: string;
    description: string;
    ingredients: string[];
    steps: string[];
    preparationTime: string;
    servings: string;
  }) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [description, setDescription] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [steps, setSteps] = useState('');
  const [preparationTime, setPreparationTime] = useState('');
  const [servings, setServings] = useState('');

  return (
    <View style={styles.form}>
      <Text style={styles.title}>Dodaj recept</Text>
      <Input label="Naziv" value={title} onChangeText={setTitle} />
      <Input label="Kratak opis" value={shortDescription} onChangeText={setShortDescription} />
      <Input label="Detaljan opis" value={description} onChangeText={setDescription} multiline />
      <Input label="Sastojci, odvojeni zarezom" value={ingredients} onChangeText={setIngredients} multiline />
      <Input label="Koraci, svaki u novom redu" value={steps} onChangeText={setSteps} multiline />
      <Input label="Vreme pripreme" value={preparationTime} onChangeText={setPreparationTime} />
      <Input label="Broj porcija" value={servings} onChangeText={setServings} />
      <NavButton
        label="Sacuvaj"
        onPress={() =>
          onAdd({
            title,
            shortDescription,
            description,
            ingredients: ingredients.split(/[,\n]+/),
            steps: steps.split(/\n+/),
            preparationTime,
            servings,
          })
        }
      />
    </View>
  );
}

function Profile({
  user,
  token,
  onOpen,
}: {
  user: User | null;
  token: string | null;
  onOpen: (id: string) => void;
}) {
  const [recipes, setRecipes] = useState<RecipeListItem[]>([]);

  useEffect(() => {
    if (token) {
      request<RecipeListItem[]>('/recipes/mine', token).then(setRecipes).catch(() => null);
    }
  }, [token]);

  return (
    <View>
      <Text style={styles.title}>Profil</Text>
      <Text style={styles.paragraph}>{user ? `${user.firstName} ${user.lastName}` : ''}</Text>
      <Text style={styles.sectionTitle}>Moji recepti</Text>
      <Recipes recipes={recipes} onOpen={onOpen} />
    </View>
  );
}

function Input({
  label,
  value,
  onChangeText,
  secureTextEntry,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
  multiline?: boolean;
}) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline ? styles.textarea : null]}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: '#f7f4ee',
  },
  topbar: {
    paddingTop: 46,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#fdfdfb',
    borderBottomWidth: 1,
    borderColor: '#d9ded8',
  },
  logo: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1f2528',
    marginBottom: 10,
  },
  nav: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  navButton: {
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    paddingHorizontal: 12,
    backgroundColor: '#1d6b5f',
  },
  navText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  content: {
    padding: 18,
    gap: 16,
  },
  title: {
    fontSize: 34,
    fontWeight: '900',
    color: '#1f2528',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '900',
    marginTop: 18,
    marginBottom: 8,
    color: '#1f2528',
  },
  paragraph: {
    color: '#657174',
    fontSize: 16,
    lineHeight: 24,
  },
  grid: {
    gap: 12,
  },
  card: {
    padding: 18,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d9ded8',
    backgroundColor: '#ffffff',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1f2528',
    marginBottom: 8,
  },
  meta: {
    marginTop: 12,
    color: '#657174',
    fontWeight: '700',
  },
  form: {
    gap: 14,
  },
  label: {
    fontWeight: '800',
    color: '#1f2528',
    marginBottom: 6,
  },
  input: {
    minHeight: 46,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d9ded8',
    backgroundColor: '#fdfdfb',
    paddingHorizontal: 12,
  },
  textarea: {
    minHeight: 92,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  message: {
    color: '#1d6b5f',
    fontWeight: '800',
  },
  error: {
    color: '#a03d3d',
    fontWeight: '800',
  },
});
