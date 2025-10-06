// api.js — paging (1000 limitni aylanib o'tadi) + exact count + GET-only
window.Api = (() => {
  let client = null;
  const init = () => (client ||= supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY));

  // ---- helper: exact count (head:true bilan GET) ----
  async function countExact(table, columns = 'id', filterFn) {
    const c = init();
    let q = c.from(table).select(columns, { count: 'exact', head: true });
    if (filterFn) q = filterFn(q);
    const { count, error } = await q;
    if (error) throw error;
    return count ?? 0;
  }

  // ---- helper: fetch all rows with paging ----
  async function selectAll(table, columns, buildQuery, step = 1000, max = 200000) {
    const c = init();
    let out = [];
    for (let from = 0; from < max; from += step) {
      let q = c.from(table).select(columns);
      if (buildQuery) q = buildQuery(q);
      q = q.range(from, from + step - 1);
      const { data, error } = await q;
      if (error) throw error;
      out = out.concat(data || []);
      if (!data || data.length < step) break;
    }
    return out;
  }

  // ---- USERS (demografiya) ----
  const fetchUsersAll = () =>
    selectAll('users', 'id, lan, place, age, gender');

  const countUsersExact = () => countExact('users', 'id');

  // ---- AISUM (app + tgbot) ----
  const fetchAisumAll = async () => {
    const app = await selectAll(
      'aisum_app',
      'created_at, ai_message, topic, gender, chat_id',
      (q) => q.order('created_at', { ascending: true })
    );
    const tg  = await selectAll(
      'aisum_tgbot',
      'created_at, ai_message, topic, doctor, chat_id',
      (q) => q.order('created_at', { ascending: true })
    );
    // normalize
    const appN = app.map(r => ({ ...r, doctor: r.doctor ?? null }));
    const tgN  = tg .map(r => ({ ...r, gender: r.gender ?? null }));
    return [...appN, ...tgN];
  };

  const countAIMsgExact = () =>
    countExact('aisum_app', 'ai_message')
      .then(c1 => countExact('aisum_tgbot', 'ai_message').then(c2 => c1 + c2));

  // ---- RATING (engagement & avg) ----
  const fetchRatingsAll = () =>
    selectAll('rating', 'name, chat_count, average, rating_all');

  // ---- CHAT HISTORY (avg session length) ----
  const fetchChatApp = () =>
    selectAll('chat_history_app', 'created_at, chat_id, ai_message, human_message');
  const fetchChatTg = () =>
    selectAll('chat_history_tg',  'created_at, chat_id, ai_message, human_message');

  return {
    // users
    fetchUsersAll, countUsersExact,
    // aisum
    fetchAisumAll, countAIMsgExact,
    // rating
    fetchRatingsAll,
    // chat history
    fetchChatApp, fetchChatTg,
  };
})();