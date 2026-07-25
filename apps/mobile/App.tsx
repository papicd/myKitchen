import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  SafeAreaView,
} from 'react-native';

// ─────────────────────────────── Types ──────────────────────────────────────
type Screen = 'home' | 'recipes' | 'find' | 'add' | 'profile' | 'login' | 'signup' | 'recipeDetail';
type TabId = 'home' | 'recipes' | 'find' | 'add' | 'profile';

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
  averageRating: number;
  ratingsCount: number;
  matchedGroceries?: number;
  postedByRecommendedUser?: boolean;
  author?: { id: string; firstName: string; lastName: string };
};

type RecipeDetails = RecipeListItem & {
  description: string;
  steps: string[];
  createdBy: string;
};

// ─────────────────────────────── Design tokens ─────────────────────────────
const C = {
  bg: '#f7f4ee',
  panel: '#ffffff',
  border: '#d9ded8',
  primary: '#1d6b5f',
  primaryLight: '#e8f4f1',
  muted: '#657174',
  fg: '#1f2528',
  gold: '#f3b940',
  chip: '#eef2ef',
  chipText: '#31403c',
  danger: '#a03d3d',
};

// ─────────────────────────────── API ────────────────────────────────────────
const API_URL =
  process.env.EXPO_PUBLIC_API_URL?.trim() ||
  (Platform.OS === 'android' ? 'http://10.0.2.2:4000/api' : 'http://localhost:4000/api');
const API_TIMEOUT_MS = 12000;

async function api<T>(
  path: string,
  token?: string | null,
  body?: unknown,
  method?: string,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  let res: Response;

  try {
    res = await fetch(`${API_URL}${path}`, {
      method: method ?? (body ? 'POST' : 'GET'),
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === 'AbortError';
    throw new Error(
      isTimeout
        ? `Server nije odgovorio na vreme. Proveri API: ${API_URL}`
        : `Nije moguce povezivanje sa API serverom: ${API_URL}`,
    );
  } finally {
    clearTimeout(timeout);
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message ?? 'Zahtev nije uspeo');
  return data as T;
}

// ─────────────────────────────── Shared components ──────────────────────────

function Stars({ rating }: { rating: number }) {
  return (
    <View style={s.starsRow}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Text key={n} style={[s.star, n <= Math.round(rating) ? s.starOn : s.starOff]}>★</Text>
      ))}
      {rating > 0 && <Text style={s.ratingNum}>{rating.toFixed(1)}</Text>}
    </View>
  );
}

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name.split(' ').map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase();
  return (
    <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[s.avatarText, { fontSize: size * 0.38 }]}>{initials}</Text>
    </View>
  );
}

function Chip({ label }: { label: string }) {
  return <View style={s.chip}><Text style={s.chipTxt}>{label}</Text></View>;
}

function EmptyState({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <View style={s.emptyState}>
      <Text style={s.emptyIcon}>{icon}</Text>
      <Text style={s.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={s.emptySubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function Eyebrow({ label }: { label: string }) {
  return <Text style={s.eyebrow}>{label}</Text>;
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={s.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function Btn({
  label, onPress, loading, danger, outline, disabled,
}: {
  label: string; onPress: () => void; loading?: boolean;
  danger?: boolean; outline?: boolean; disabled?: boolean;
}) {
  const bg = danger ? C.danger : outline ? 'transparent' : C.primary;
  const color = outline ? C.fg : '#ffffff';
  return (
    <Pressable
      onPress={onPress}
      disabled={loading || disabled}
      style={({ pressed }) => [
        s.btn,
        { backgroundColor: bg, borderColor: outline ? C.border : 'transparent', borderWidth: outline ? 1 : 0 },
        (pressed || loading || disabled) && { opacity: 0.72 },
        !outline && !danger && s.btnShadow,
      ]}
    >
      {loading
        ? <ActivityIndicator color={color} size="small" />
        : <Text style={[s.btnText, { color }]}>{label}</Text>}
    </Pressable>
  );
}

function Field({
  label, value, onChangeText, placeholder, secure, multiline,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; secure?: boolean; multiline?: boolean;
}) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={[s.input, multiline && s.inputMulti]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.muted}
        secureTextEntry={secure}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : undefined}
      />
    </View>
  );
}

// ─────────────────────────────── Recipe Card ────────────────────────────────

function RecipeCard({ recipe, onPress }: { recipe: RecipeListItem; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.recipeCard, pressed && s.cardPressed]}
    >
      {recipe.postedByRecommendedUser && (
        <View style={s.badge}><Text style={s.badgeText}>⭐ Preporučeni autor</Text></View>
      )}
      <Text style={s.recipeCardTitle}>{recipe.title}</Text>
      <Text style={s.recipeCardDesc} numberOfLines={2}>{recipe.shortDescription}</Text>
      <Stars rating={recipe.averageRating ?? 0} />
      <View style={s.metaRow}>
        <View style={s.metaItem}><Text style={s.metaIcon}>⏱</Text><Text style={s.metaText}>{recipe.preparationTime}</Text></View>
        <View style={s.metaItem}><Text style={s.metaIcon}>🍽</Text><Text style={s.metaText}>{recipe.servings}</Text></View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginTop: 4 }}
        contentContainerStyle={{ gap: 8 }}
      >
        {recipe.ingredients.slice(0, 6).map((ing) => <Chip key={ing} label={ing} />)}
      </ScrollView>
      {recipe.author ? (
        <View style={s.cardFooter}>
          <Avatar name={`${recipe.author.firstName} ${recipe.author.lastName}`} size={26} />
          <Text style={s.authorName}>{recipe.author.firstName} {recipe.author.lastName}</Text>
          <Text style={s.arrow}>→</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

// ─────────────────────────────── Screen: Home ───────────────────────────────

function HomeScreen({
  isLoggedIn, user, onNavigate,
}: {
  isLoggedIn: boolean; user: User | null;
  onNavigate: (t: TabId | 'login' | 'signup') => void;
}) {
  const features: { icon: string; title: string; desc: string; tab: TabId | 'login' }[] = [
    { icon: '🍲', title: 'Recepti', desc: 'Pregledaj domaće recepte i detalje.', tab: 'recipes' },
    { icon: '🥕', title: 'Pretraga po namirnicama', desc: 'Pronađi jelo od onoga što imaš.', tab: isLoggedIn ? 'find' : 'login' },
    { icon: '🧑‍🍳', title: 'Dodaj recept', desc: 'Podeli svoju kulinarsku ideju.', tab: isLoggedIn ? 'add' : 'login' },
  ];

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      {/* Hero */}
      <View style={s.heroCard}>
        <View style={s.heroBrandRow}>
          <View style={s.heroBrandMark}><Text style={{ fontSize: 24 }}>🍲</Text></View>
          <View>
            <Text style={s.heroBrandName}>Moja Kuhinja</Text>
            <Text style={s.heroBrandSub}>DOMAĆA KUHINJA</Text>
          </View>
        </View>
        <Text style={s.heroTitle}>Kuvaj ono što već imaš.</Text>
        <Text style={s.heroLead}>
          Planiraj obroke, čuvaj recepte i pronađi šta možeš da skuvaš od namirnica koje imaš.
        </Text>
        <View style={s.heroStats}>
          <View style={s.heroStat}><Text style={s.heroStatNum}>01</Text><Text style={s.heroStatLabel}>Recepti</Text></View>
          <View style={s.heroStatDivider} />
          <View style={s.heroStat}><Text style={s.heroStatNum}>02</Text><Text style={s.heroStatLabel}>Pretraga</Text></View>
          <View style={s.heroStatDivider} />
          <View style={s.heroStat}><Text style={s.heroStatNum}>03</Text><Text style={s.heroStatLabel}>AI</Text></View>
        </View>
        <View style={s.heroActions}>
          <Pressable
            style={({ pressed }) => [s.heroPrimary, pressed && { opacity: 0.8 }]}
            onPress={() => onNavigate('recipes')}
          >
            <Text style={s.heroPrimaryText}>Pogledaj recepte →</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [s.heroSecondary, pressed && { opacity: 0.8 }]}
            onPress={() => onNavigate(isLoggedIn ? 'find' : 'login')}
          >
            <Text style={s.heroSecondaryText}>{isLoggedIn ? 'Pronađi jelo' : 'Prijavi se'}</Text>
          </Pressable>
        </View>
      </View>

      <View style={{ gap: 4 }}>
        <Eyebrow label="FUNKCIJE" />
        <SectionTitle title="Sve na jednom mestu" />
      </View>

      {features.map((f) => (
        <Pressable
          key={f.title}
          onPress={() => onNavigate(f.tab)}
          style={({ pressed }) => [s.featureCard, pressed && s.cardPressed]}
        >
          <View style={s.featureIconWrap}><Text style={{ fontSize: 24 }}>{f.icon}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.featureTitle}>{f.title}</Text>
            <Text style={s.featureDesc}>{f.desc}</Text>
          </View>
          <Text style={[s.arrow, { fontSize: 20 }]}>→</Text>
        </Pressable>
      ))}

      {isLoggedIn && user ? (
        <View style={s.welcomeCard}>
          <Avatar name={`${user.firstName} ${user.lastName}`} size={48} />
          <View style={{ flex: 1 }}>
            <Text style={s.welcomeName}>Zdravo, {user.firstName}! 👋</Text>
            <Text style={s.welcomeSub}>Prijavljeni ste na Moja Kuhinja.</Text>
          </View>
        </View>
      ) : (
        <View style={s.ctaCard}>
          <Text style={s.ctaTitle}>Napravi nalog</Text>
          <Text style={s.ctaDesc}>
            Registruj se da bi dodavao recepte, pretraživao po namirnicama i koristio AI asistenta.
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}><Btn label="Prijava" onPress={() => onNavigate('login')} /></View>
            <View style={{ flex: 1 }}><Btn label="Registracija" onPress={() => onNavigate('signup')} outline /></View>
          </View>
        </View>
      )}
      <View style={{ height: 16 }} />
    </ScrollView>
  );
}

// ─────────────────────────────── Screen: Recipes ────────────────────────────

function RecipesScreen({
  recipes, loading, error, onOpen, onRefresh, refreshing,
}: {
  recipes: RecipeListItem[];
  loading: boolean;
  error: string;
  onOpen: (id: string) => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  return (
    <ScrollView
      style={s.scroll}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
      refreshControl={(
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
      )}
    >
      <View style={{ gap: 4 }}>
        <Eyebrow label="RECEPTI" />
        <SectionTitle title="Domaća kuhinja" subtitle="Kratak pregled je javan, detalji traže prijavu." />
      </View>
      {error ? <Text style={s.errorText}>{error}</Text> : null}
      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={C.primary} />
          <Text style={s.loadingText}>Učitavanje recepata...</Text>
        </View>
      ) : recipes.length === 0 ? (
        <EmptyState icon="🍽" title="Nema recepata" subtitle="Recepti trenutno nisu dostupni." />
      ) : (
        recipes.map((r) => <RecipeCard key={r.id} recipe={r} onPress={() => onOpen(r.id)} />)
      )}
    </ScrollView>
  );
}

// ─────────────────────────────── Screen: Recipe Detail ──────────────────────

function RecipeDetailScreen({ recipe, onBack }: { recipe: RecipeDetails; onBack: () => void }) {
  return (
    <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
      <Pressable onPress={onBack} style={s.backBtn}>
        <Text style={s.backBtnText}>← Nazad</Text>
      </Pressable>

      <View style={s.detailHero}>
        {recipe.postedByRecommendedUser && (
          <View style={[s.badge, { alignSelf: 'flex-start', marginBottom: 12 }]}>
            <Text style={s.badgeText}>⭐ Preporučeni autor</Text>
          </View>
        )}
        <Text style={s.detailTitle}>{recipe.title}</Text>
        <Text style={s.detailDesc}>{recipe.description}</Text>
        <Stars rating={recipe.averageRating ?? 0} />
        <View style={s.detailMetaRow}>
          <View style={s.detailMetaCard}>
            <Text style={s.detailMetaLabel}>PRIPREMA</Text>
            <Text style={s.detailMetaValue}>{recipe.preparationTime}</Text>
          </View>
          <View style={s.detailMetaCard}>
            <Text style={s.detailMetaLabel}>PORCIJE</Text>
            <Text style={s.detailMetaValue}>{recipe.servings}</Text>
          </View>
        </View>
      </View>

      <View style={s.detailSection}>
        <Text style={s.detailSectionTitle}>🧂 Sastojci</Text>
        {recipe.ingredients.map((ing, i) => (
          <View key={`${ing}-${i}`} style={s.listItem}>
            <View style={s.bullet} />
            <Text style={s.listText}>{ing}</Text>
          </View>
        ))}
      </View>

      <View style={s.detailSection}>
        <Text style={s.detailSectionTitle}>👩‍🍳 Koraci pripreme</Text>
        {recipe.steps.map((step, i) => (
          <View key={`${step}-${i}`} style={s.stepItem}>
            <View style={s.stepNum}><Text style={s.stepNumText}>{i + 1}</Text></View>
            <Text style={s.stepText}>{step}</Text>
          </View>
        ))}
      </View>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─────────────────────────────── Screen: Find ───────────────────────────────

function FindScreen({
  token, isLoggedIn, onNavigate,
}: {
  token: string | null; isLoggedIn: boolean; onNavigate: (t: TabId | 'login') => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RecipeListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<RecipeDetails | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  if (!isLoggedIn) {
    return (
      <View style={s.gate}>
        <EmptyState icon="🔍" title="Pretraga zahteva prijavu" subtitle="Prijavi se da bi pretraživao recepte po namirnicama." />
        <Btn label="Prijavi se" onPress={() => onNavigate('login')} />
      </View>
    );
  }

  if (detail) return <RecipeDetailScreen recipe={detail} onBack={() => setDetail(null)} />;

  async function search() {
    if (!query.trim() || !token) return;
    setLoading(true); setError('');
    setHasSearched(true);
    try {
      const res = await api<RecipeListItem[]>(`/recipes/search?q=${encodeURIComponent(query)}`, token);
      setResults(res);
    } catch (e) { setError(e instanceof Error ? e.message : 'Pretraga nije uspela'); }
    finally { setLoading(false); }
  }

  async function openDetail(id: string) {
    if (!token) return;
    try { setDetail(await api<RecipeDetails>(`/recipes/${id}`, token)); } catch {}
  }

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <View style={{ gap: 4 }}>
        <Eyebrow label="PRETRAGA" />
        <SectionTitle title="Pronađi jelo" subtitle="Unesi namirnice odvojene zarezom ili razmakom." />
      </View>
      <View style={s.searchRow}>
        <TextInput
          style={s.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="piletina, pirinač, paprika..."
          placeholderTextColor={C.muted}
          onSubmitEditing={search}
          returnKeyType="search"
        />
        <Pressable onPress={search} style={({ pressed }) => [s.searchBtn, pressed && { opacity: 0.8 }]}>
          <Text style={{ fontSize: 22 }}>🔍</Text>
        </Pressable>
      </View>
      {error ? <Text style={s.errorText}>{error}</Text> : null}
      {loading && (
        <View style={s.loadingWrap}>
          <ActivityIndicator color={C.primary} />
          <Text style={s.loadingText}>Pretraga...</Text>
        </View>
      )}
      {!loading && hasSearched && results.length === 0 ? (
        <EmptyState icon="🍳" title="Nema rezultata" subtitle="Probaj druge namirnice ili manje pojmova." />
      ) : null}
      {results.map((r) => <RecipeCard key={r.id} recipe={r} onPress={() => openDetail(r.id)} />)}
    </ScrollView>
  );
}

// ─────────────────────────────── Screen: Add Recipe ─────────────────────────

function AddScreen({
  token, isLoggedIn, onNavigate, onSuccess,
}: {
  token: string | null; isLoggedIn: boolean;
  onNavigate: (t: TabId | 'login') => void; onSuccess: () => void;
}) {
  const [title, setTitle] = useState('');
  const [shortDesc, setShortDesc] = useState('');
  const [desc, setDesc] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [steps, setSteps] = useState('');
  const [prepTime, setPrepTime] = useState('');
  const [servings, setServings] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  if (!isLoggedIn) {
    return (
      <View style={s.gate}>
        <EmptyState icon="🧑‍🍳" title="Dodavanje recepta zahteva prijavu" />
        <Btn label="Prijavi se" onPress={() => onNavigate('login')} />
      </View>
    );
  }

  async function submit() {
    if (!token) return;
    setLoading(true); setError('');
    try {
      await api('/recipes', token, {
        title, shortDescription: shortDesc, description: desc,
        ingredients: ingredients.split(/[,\n]+/).map((x) => x.trim()).filter(Boolean),
        steps: steps.split(/\n+/).map((x) => x.trim()).filter(Boolean),
        preparationTime: prepTime, servings,
      });
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        setTitle(''); setShortDesc(''); setDesc('');
        setIngredients(''); setSteps(''); setPrepTime(''); setServings('');
        onSuccess();
      }, 1800);
    } catch (e) { setError(e instanceof Error ? e.message : 'Recept nije sačuvan'); }
    finally { setLoading(false); }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={{ gap: 4 }}>
          <Eyebrow label="DODAJ" />
          <SectionTitle title="Novi recept" subtitle="Svi tekstovi trebaju biti na srpskom jeziku." />
        </View>
        {saved && <View style={s.successBanner}><Text style={s.successText}>✓ Recept je sačuvan!</Text></View>}
        <Field label="Naziv recepta" value={title} onChangeText={setTitle} />
        <Field label="Kratak opis" value={shortDesc} onChangeText={setShortDesc} />
        <Field label="Detaljan opis" value={desc} onChangeText={setDesc} multiline />
        <Field label="Sastojci (odvojeni zarezom)" value={ingredients} onChangeText={setIngredients} multiline placeholder="piletina, pirinač, paprika" />
        <Field label="Koraci (svaki u novom redu)" value={steps} onChangeText={setSteps} multiline />
        <Field label="Vreme pripreme" value={prepTime} onChangeText={setPrepTime} placeholder="45 minuta" />
        <Field label="Broj porcija" value={servings} onChangeText={setServings} placeholder="4 porcije" />
        {error ? <Text style={s.errorText}>{error}</Text> : null}
        <Btn label="Sačuvaj recept" onPress={submit} loading={loading} />
        <View style={{ height: 24 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────── Screen: Login ──────────────────────────────

function LoginScreen({ onLogin, onGoSignup }: { onLogin: (e: string, p: string) => Promise<void>; onGoSignup: () => void }) {
  const [email, setEmail] = useState('a@a.a');
  const [password, setPassword] = useState('12');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setError(''); setLoading(true);
    try { await onLogin(email, password); }
    catch (e) { setError(e instanceof Error ? e.message : 'Prijava nije uspela'); }
    finally { setLoading(false); }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={s.scroll} contentContainerStyle={[s.content, s.centeredContent]} showsVerticalScrollIndicator={false}>
        <View style={s.authCard}>
          <View style={s.authIconWrap}><Text style={s.authIcon}>🔐</Text></View>
          <Text style={s.authTitle}>Prijava</Text>
          <Text style={s.authSubtitle}>Koristi nalog da vidiš detalje recepata i dodaješ svoje recepte.</Text>
          <Field label="Email" value={email} onChangeText={setEmail} />
          <Field label="Lozinka" value={password} onChangeText={setPassword} secure />
          {error ? <Text style={s.errorText}>{error}</Text> : null}
          <Btn label="Prijavi se" onPress={submit} loading={loading} />
          <Pressable onPress={onGoSignup} style={s.switchAuth}>
            <Text style={s.switchAuthText}>
              Nemaš nalog?{' '}
              <Text style={{ color: C.primary, fontWeight: '800' }}>Registruj se</Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────── Screen: Signup ─────────────────────────────

function SignupScreen({
  onSignup, onGoLogin,
}: {
  onSignup: (i: { firstName: string; lastName: string; username: string; email: string; password: string }) => Promise<void>;
  onGoLogin: () => void;
}) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setError(''); setLoading(true);
    try { await onSignup({ firstName, lastName, username, email, password }); }
    catch (e) { setError(e instanceof Error ? e.message : 'Registracija nije uspela'); }
    finally { setLoading(false); }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={s.scroll} contentContainerStyle={[s.content, s.centeredContent]} showsVerticalScrollIndicator={false}>
        <View style={s.authCard}>
          <View style={s.authIconWrap}><Text style={s.authIcon}>👤</Text></View>
          <Text style={s.authTitle}>Registracija</Text>
          <Text style={s.authSubtitle}>Napravi nalog za dodavanje recepata i pretragu po namirnicama.</Text>
          <Field label="Ime" value={firstName} onChangeText={setFirstName} />
          <Field label="Prezime" value={lastName} onChangeText={setLastName} />
          <Field label="Korisničko ime" value={username} onChangeText={setUsername} />
          <Field label="Email" value={email} onChangeText={setEmail} />
          <Field label="Lozinka" value={password} onChangeText={setPassword} secure />
          {error ? <Text style={s.errorText}>{error}</Text> : null}
          <Btn label="Registruj se" onPress={submit} loading={loading} />
          <Pressable onPress={onGoLogin} style={s.switchAuth}>
            <Text style={s.switchAuthText}>
              Već imaš nalog?{' '}
              <Text style={{ color: C.primary, fontWeight: '800' }}>Prijavi se</Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────── Screen: Profile ────────────────────────────

function ProfileScreen({
  user, token, isLoggedIn, onNavigate, onLogout, onOpenRecipe,
}: {
  user: User | null; token: string | null; isLoggedIn: boolean;
  onNavigate: (t: TabId | 'login') => void; onLogout: () => void; onOpenRecipe: (id: string) => void;
}) {
  const [myRecipes, setMyRecipes] = useState<RecipeListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function loadMyRecipes() {
    if (!token) return;
    setLoading(true);
    try {
      const data = await api<RecipeListItem[]>('/recipes/mine', token);
      setMyRecipes(data);
    } catch {
      // Intentionally silent here to keep the profile view usable.
    } finally {
      setLoading(false);
    }
  }

  async function refreshMyRecipes() {
    if (!token) return;
    setRefreshing(true);
    try {
      const data = await api<RecipeListItem[]>('/recipes/mine', token);
      setMyRecipes(data);
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadMyRecipes();
  }, [token]);

  if (!isLoggedIn) {
    return (
      <View style={s.gate}>
        <EmptyState icon="👤" title="Profil zahteva prijavu" subtitle="Prijavi se da vidiš profil i svoje recepte." />
        <Btn label="Prijavi se" onPress={() => onNavigate('login')} />
      </View>
    );
  }

  const initials = user ? `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase() : '?';

  return (
    <ScrollView
      style={s.scroll}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
      refreshControl={(
        <RefreshControl refreshing={refreshing} onRefresh={refreshMyRecipes} tintColor={C.primary} />
      )}
    >
      <View style={s.profileCard}>
        <View style={s.profileAvatarWrap}><Text style={s.profileAvatarText}>{initials}</Text></View>
        <Text style={s.profileName}>{user?.firstName} {user?.lastName}</Text>
        <Text style={s.profileUsername}>@{user?.username}</Text>
        <Text style={s.profileEmail}>{user?.email}</Text>
        {user?.isAdmin ? (
          <View style={[s.badge, { marginTop: 10 }]}><Text style={s.badgeText}>⚙️ Administrator</Text></View>
        ) : null}
      </View>

      <View style={{ gap: 4 }}>
        <Eyebrow label="MOJI" />
        <SectionTitle title="Moji recepti" />
      </View>

      {loading
        ? <View style={s.loadingWrap}><ActivityIndicator color={C.primary} /></View>
        : myRecipes.length === 0
          ? <EmptyState icon="📝" title="Još nisi dodao recept" subtitle="Dodaj svoj prvi recept!" />
          : myRecipes.map((r) => <RecipeCard key={r.id} recipe={r} onPress={() => onOpenRecipe(r.id)} />)
      }

      <View style={{ height: 8 }} />
      <Btn label="Odjava" onPress={onLogout} danger />
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

// ─────────────────────────────── App Header ─────────────────────────────────

function AppHeader({ user }: { user: User | null }) {
  const initials = user ? `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase() : null;
  return (
    <View style={s.appHeader}>
      <View style={s.appHeaderBrand}>
        <View style={s.appHeaderMark}><Text style={{ fontSize: 22 }}>🍲</Text></View>
        <View>
          <Text style={s.appHeaderName}>Moja Kuhinja</Text>
          <Text style={s.appHeaderSub}>DOMAĆA KUHINJA</Text>
        </View>
      </View>
      {initials ? (
        <View style={s.appHeaderAvatar}><Text style={s.appHeaderAvatarText}>{initials}</Text></View>
      ) : null}
    </View>
  );
}

// ─────────────────────────────── Bottom Tab Bar ──────────────────────────────

const ALL_TABS: { id: TabId; icon: string; label: string; authRequired?: boolean }[] = [
  { id: 'home', icon: '🏠', label: 'Početna' },
  { id: 'recipes', icon: '🍲', label: 'Recepti' },
  { id: 'find', icon: '🔍', label: 'Pretraga', authRequired: true },
  { id: 'add', icon: '➕', label: 'Dodaj', authRequired: true },
  { id: 'profile', icon: '👤', label: 'Profil' },
];

function TabBar({ active, isLoggedIn, onPress }: { active: TabId; isLoggedIn: boolean; onPress: (t: TabId) => void }) {
  const tabs = ALL_TABS.filter((t) => !t.authRequired || isLoggedIn);
  return (
    <View style={s.tabBar}>
      {tabs.map((t) => {
        const on = active === t.id;
        return (
          <Pressable key={t.id} style={s.tabItem} onPress={() => onPress(t.id)}>
            <View style={[s.tabIconWrap, on && s.tabIconWrapActive]}>
              <Text style={s.tabIcon}>{t.icon}</Text>
            </View>
            <Text style={[s.tabLabel, on && s.tabLabelActive]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─────────────────────────────── Root App ───────────────────────────────────

export default function App() {
  const [tab, setTab] = useState<TabId>('home');
  const [screen, setScreen] = useState<Screen>('home');
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [recipes, setRecipes] = useState<RecipeListItem[]>([]);
  const [recipesLoading, setRecipesLoading] = useState(true);
  const [recipesRefreshing, setRecipesRefreshing] = useState(false);
  const [recipesError, setRecipesError] = useState('');
  const [detailRecipe, setDetailRecipe] = useState<RecipeDetails | null>(null);

  const isLoggedIn = Boolean(token && user);

  async function loadRecipes() {
    setRecipesLoading(true);
    setRecipesError('');
    try {
      const data = await api<RecipeListItem[]>('/recipes');
      setRecipes(data);
    } catch {
      setRecipesError('Recepti trenutno nisu dostupni.');
    } finally {
      setRecipesLoading(false);
    }
  }

  async function refreshRecipes() {
    setRecipesRefreshing(true);
    setRecipesError('');
    try {
      const data = await api<RecipeListItem[]>('/recipes');
      setRecipes(data);
    } catch {
      setRecipesError('Recepti trenutno nisu dostupni.');
    } finally {
      setRecipesRefreshing(false);
    }
  }

  useEffect(() => {
    loadRecipes();
  }, []);

  async function login(email: string, password: string) {
    const auth = await api<{ token: string; user: User }>('/auth/login', null, { email, password });
    setToken(auth.token); setUser(auth.user); goTab('home');
  }

  async function signup(input: { firstName: string; lastName: string; username: string; email: string; password: string }) {
    const auth = await api<{ token: string; user: User }>('/auth/register', null, input);
    setToken(auth.token); setUser(auth.user); goTab('home');
  }

  function logout() { setToken(null); setUser(null); setDetailRecipe(null); goTab('home'); }

  async function openRecipe(id: string) {
    if (!token) { goTab('profile'); return; }
    try {
      const r = await api<RecipeDetails>(`/recipes/${id}`, token);
      setDetailRecipe(r); setScreen('recipeDetail');
    } catch {}
  }

  function goTab(t: TabId) { setTab(t); setScreen(t as Screen); setDetailRecipe(null); }

  function handleNavigate(dest: TabId | 'login' | 'signup') {
    if (dest === 'login' || dest === 'signup') { setScreen(dest); setTab('profile'); }
    else { goTab(dest); }
  }

  const renderContent = () => {
    if (detailRecipe && screen === 'recipeDetail') {
      return (
        <RecipeDetailScreen
          recipe={detailRecipe}
          onBack={() => { setDetailRecipe(null); setScreen(tab as Screen); }}
        />
      );
    }
    if (screen === 'login') return <LoginScreen onLogin={login} onGoSignup={() => setScreen('signup')} />;
    if (screen === 'signup') return <SignupScreen onSignup={signup} onGoLogin={() => setScreen('login')} />;

    switch (tab) {
      case 'home':
        return <HomeScreen isLoggedIn={isLoggedIn} user={user} onNavigate={handleNavigate} />;
      case 'recipes':
        return (
          <RecipesScreen
            recipes={recipes}
            loading={recipesLoading}
            error={recipesError}
            onOpen={openRecipe}
            onRefresh={refreshRecipes}
            refreshing={recipesRefreshing}
          />
        );
      case 'find':
        return <FindScreen token={token} isLoggedIn={isLoggedIn} onNavigate={handleNavigate} />;
      case 'add':
        return (
          <AddScreen
            token={token}
            isLoggedIn={isLoggedIn}
            onNavigate={handleNavigate}
            onSuccess={() => {
              api<RecipeListItem[]>('/recipes').then(setRecipes).catch(() => null);
              goTab('profile');
            }}
          />
        );
      case 'profile':
        return (
          <ProfileScreen
            user={user}
            token={token}
            isLoggedIn={isLoggedIn}
            onNavigate={handleNavigate}
            onLogout={logout}
            onOpenRecipe={openRecipe}
          />
        );
    }
  };

  return (
    <SafeAreaView style={s.root}>
      <StatusBar style="dark" />
      <AppHeader user={user} />
      <View style={{ flex: 1 }}>{renderContent()}</View>
      <TabBar active={tab} isLoggedIn={isLoggedIn} onPress={goTab} />
    </SafeAreaView>
  );
}

// ─────────────────────────────── Styles ─────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // App header
  appHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
    backgroundColor: 'rgba(253,253,251,0.97)',
  },
  appHeaderBrand: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  appHeaderMark: {
    width: 42, height: 42, borderRadius: 14, backgroundColor: C.primary,
    alignItems: 'center', justifyContent: 'center',
    elevation: 3, shadowColor: C.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.28, shadowRadius: 12,
  },
  appHeaderName: { fontSize: 18, fontWeight: '900', color: C.fg },
  appHeaderSub: { fontSize: 10, fontWeight: '800', color: C.muted, letterSpacing: 1.2 },
  appHeaderAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.primaryLight, borderWidth: 1, borderColor: C.primary + '33',
    alignItems: 'center', justifyContent: 'center',
  },
  appHeaderAvatarText: { fontSize: 13, fontWeight: '900', color: C.primary },

  // Layout
  scroll: { flex: 1, backgroundColor: C.bg },
  content: { padding: 18, gap: 16, paddingBottom: 32 },
  centeredContent: { flexGrow: 1, justifyContent: 'center' },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1, borderTopColor: C.border,
    backgroundColor: 'rgba(253,253,251,0.97)',
    paddingTop: 8, paddingBottom: Platform.OS === 'ios' ? 22 : 10,
  },
  tabItem: { flex: 1, alignItems: 'center', gap: 4 },
  tabIconWrap: { width: 46, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tabIconWrapActive: { backgroundColor: C.primaryLight },
  tabIcon: { fontSize: 20 },
  tabLabel: { fontSize: 10, fontWeight: '800', color: C.muted },
  tabLabelActive: { color: C.primary },

  // Typography helpers
  eyebrow: { fontSize: 11, fontWeight: '900', color: C.primary, letterSpacing: 1.4 },
  sectionHeader: { gap: 6 },
  sectionTitle: { fontSize: 28, fontWeight: '900', color: C.fg, lineHeight: 32 },
  sectionSubtitle: { fontSize: 14, color: C.muted, lineHeight: 22 },
  arrow: { color: C.primary, fontWeight: '900' },

  // Hero
  heroCard: {
    borderRadius: 24, borderWidth: 1, borderColor: C.border, backgroundColor: C.panel,
    padding: 24, gap: 16,
    elevation: 4, shadowColor: C.fg, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.08, shadowRadius: 24,
  },
  heroBrandRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroBrandMark: {
    width: 50, height: 50, borderRadius: 17, backgroundColor: C.primary,
    alignItems: 'center', justifyContent: 'center',
    elevation: 4, shadowColor: C.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.28, shadowRadius: 16,
  },
  heroBrandName: { fontSize: 20, fontWeight: '900', color: C.fg },
  heroBrandSub: { fontSize: 10, fontWeight: '800', color: C.muted, letterSpacing: 1.2 },
  heroTitle: { fontSize: 34, fontWeight: '900', color: C.fg, lineHeight: 38, letterSpacing: -0.5 },
  heroLead: { fontSize: 15, color: C.muted, lineHeight: 24 },
  heroStats: { flexDirection: 'row', alignItems: 'center' },
  heroStat: { flex: 1, alignItems: 'center', gap: 4 },
  heroStatNum: { fontSize: 13, fontWeight: '900', color: C.primary, letterSpacing: 1 },
  heroStatLabel: { fontSize: 11, fontWeight: '800', color: C.fg },
  heroStatDivider: { width: 1, height: 32, backgroundColor: C.border },
  heroActions: { flexDirection: 'row', gap: 12 },
  heroPrimary: {
    flex: 1, minHeight: 50, borderRadius: 14, backgroundColor: C.primary,
    alignItems: 'center', justifyContent: 'center',
    elevation: 4, shadowColor: C.primary, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.26, shadowRadius: 20,
  },
  heroPrimaryText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  heroSecondary: {
    flex: 1, minHeight: 50, borderRadius: 14, backgroundColor: C.panel,
    borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center',
  },
  heroSecondaryText: { color: C.fg, fontWeight: '800', fontSize: 15 },

  // Feature cards
  featureCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    padding: 18, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.panel,
    elevation: 2, shadowColor: C.fg, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.05, shadowRadius: 16,
  },
  featureIconWrap: {
    width: 50, height: 50, borderRadius: 17, backgroundColor: C.primaryLight,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  featureTitle: { fontSize: 16, fontWeight: '900', color: C.fg, marginBottom: 2 },
  featureDesc: { fontSize: 13, color: C.muted, lineHeight: 18 },

  // Welcome / CTA
  welcomeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16, padding: 20,
    borderRadius: 20, borderWidth: 1, borderColor: C.primary + '33', backgroundColor: C.primaryLight,
  },
  welcomeName: { fontSize: 16, fontWeight: '900', color: C.fg },
  welcomeSub: { fontSize: 13, color: C.muted, marginTop: 2 },
  ctaCard: {
    padding: 22, borderRadius: 22, borderWidth: 1, borderColor: C.border, backgroundColor: C.panel, gap: 12,
    elevation: 2, shadowColor: C.fg, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.05, shadowRadius: 16,
  },
  ctaTitle: { fontSize: 20, fontWeight: '900', color: C.fg },
  ctaDesc: { fontSize: 14, color: C.muted, lineHeight: 22 },

  // Recipe card
  recipeCard: {
    borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.panel,
    padding: 20, gap: 10,
    elevation: 3, shadowColor: C.fg, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.06, shadowRadius: 20,
  },
  cardPressed: { opacity: 0.87 },
  recipeCardTitle: { fontSize: 20, fontWeight: '900', color: C.fg, lineHeight: 24 },
  recipeCardDesc: { fontSize: 14, color: C.muted, lineHeight: 21 },
  metaRow: { flexDirection: 'row', gap: 16 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaIcon: { fontSize: 13 },
  metaText: { fontSize: 13, fontWeight: '700', color: C.muted },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  authorName: { flex: 1, fontSize: 12, fontWeight: '800', color: C.muted },

  // Stars
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  star: { fontSize: 15 },
  starOn: { color: C.gold },
  starOff: { color: C.border },
  ratingNum: { fontSize: 12, fontWeight: '800', color: C.muted, marginLeft: 4 },

  // Avatar
  avatar: { backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.primary + '33' },
  avatarText: { fontWeight: '900', color: C.primary },

  // Chip
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: C.chip },
  chipTxt: { fontSize: 12, fontWeight: '800', color: C.chipText },

  // Badge
  badge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: C.primaryLight },
  badgeText: { fontSize: 11, fontWeight: '900', color: C.primary, letterSpacing: 0.4 },

  // Empty / loading
  emptyState: { alignItems: 'center', gap: 12, paddingVertical: 48 },
  emptyIcon: { fontSize: 52 },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: C.fg, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 22 },
  loadingWrap: { alignItems: 'center', gap: 12, paddingVertical: 40 },
  loadingText: { fontSize: 14, color: C.muted, fontWeight: '700' },

  // Back button
  backBtn: { padding: 18 },
  backBtnText: { fontSize: 16, fontWeight: '800', color: C.primary },

  // Detail
  detailHero: { paddingHorizontal: 20, paddingBottom: 24, gap: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  detailTitle: { fontSize: 30, fontWeight: '900', color: C.fg, lineHeight: 34, letterSpacing: -0.5 },
  detailDesc: { fontSize: 16, color: C.muted, lineHeight: 26 },
  detailMetaRow: { flexDirection: 'row', gap: 12 },
  detailMetaCard: {
    flex: 1, borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: C.panel,
    padding: 14, gap: 6,
    elevation: 1, shadowColor: C.fg, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 8,
  },
  detailMetaLabel: { fontSize: 10, fontWeight: '900', color: C.muted, letterSpacing: 1 },
  detailMetaValue: { fontSize: 16, fontWeight: '900', color: C.fg },
  detailSection: { padding: 20, paddingTop: 24, gap: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  detailSectionTitle: { fontSize: 20, fontWeight: '900', color: C.fg, marginBottom: 2 },
  listItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  bullet: { marginTop: 7, width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary, flexShrink: 0 },
  listText: { flex: 1, fontSize: 15, color: C.fg, lineHeight: 23 },
  stepItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  stepNum: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: C.primaryLight,
    borderWidth: 1, borderColor: C.primary + '33', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  stepNumText: { fontSize: 13, fontWeight: '900', color: C.primary },
  stepText: { flex: 1, fontSize: 15, color: C.fg, lineHeight: 24, paddingTop: 4 },

  // Search
  searchRow: { flexDirection: 'row', gap: 10 },
  searchInput: {
    flex: 1, minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: C.border,
    backgroundColor: C.panel, paddingHorizontal: 16, fontSize: 16, color: C.fg,
    elevation: 1, shadowColor: C.fg, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 8,
  },
  searchBtn: {
    width: 52, height: 52, borderRadius: 14, backgroundColor: C.primary,
    alignItems: 'center', justifyContent: 'center',
    elevation: 4, shadowColor: C.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.26, shadowRadius: 16,
  },

  // Auth
  authCard: {
    borderRadius: 24, borderWidth: 1, borderColor: C.border, backgroundColor: C.panel,
    padding: 28, gap: 16,
    elevation: 4, shadowColor: C.fg, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.08, shadowRadius: 24,
  },
  authIconWrap: {
    width: 70, height: 70, borderRadius: 24, backgroundColor: C.primaryLight,
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center',
  },
  authIcon: { fontSize: 34 },
  authTitle: { fontSize: 28, fontWeight: '900', color: C.fg, textAlign: 'center' },
  authSubtitle: { fontSize: 15, color: C.muted, textAlign: 'center', lineHeight: 22 },
  switchAuth: { alignItems: 'center', paddingVertical: 8 },
  switchAuthText: { fontSize: 14, color: C.muted },

  // Form
  field: { gap: 8 },
  fieldLabel: { fontSize: 13, fontWeight: '800', color: C.fg },
  input: {
    minHeight: 52, borderRadius: 12, borderWidth: 1, borderColor: C.border,
    backgroundColor: '#fdfdfb', paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: C.fg,
  },
  inputMulti: { minHeight: 110, textAlignVertical: 'top' },

  // Button
  btn: { minHeight: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  btnShadow: { elevation: 4, shadowColor: C.primary, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.22, shadowRadius: 20 },
  btnText: { fontSize: 16, fontWeight: '900' },

  // Profile
  profileCard: {
    alignItems: 'center', padding: 28, borderRadius: 24, borderWidth: 1, borderColor: C.border, backgroundColor: C.panel, gap: 6,
    elevation: 3, shadowColor: C.fg, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.06, shadowRadius: 20,
  },
  profileAvatarWrap: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: C.primaryLight,
    borderWidth: 2, borderColor: C.primary + '33', alignItems: 'center', justifyContent: 'center',
  },
  profileAvatarText: { fontSize: 28, fontWeight: '900', color: C.primary },
  profileName: { fontSize: 22, fontWeight: '900', color: C.fg },
  profileUsername: { fontSize: 14, fontWeight: '700', color: C.muted },
  profileEmail: { fontSize: 13, color: C.muted },

  // Feedback
  errorText: { fontSize: 14, fontWeight: '700', color: C.danger },
  successBanner: { borderRadius: 12, backgroundColor: C.primaryLight, padding: 16, alignItems: 'center' },
  successText: { fontSize: 15, fontWeight: '900', color: C.primary },

  // Gate
  gate: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 24 },
});
