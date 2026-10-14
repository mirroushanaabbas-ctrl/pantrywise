import React, { useState, useEffect, useMemo } from 'react';
import { 
  Home, ShoppingCart, Archive, ChefHat, LineChart, 
  Plus, Trash2, CheckCircle, AlertTriangle, X, 
  ChevronRight, Calculator, IndianRupee, Clock,
  Smartphone, Info
} from 'lucide-react';

// 1. Database Setup (LocalStorage mock replacing Dexie for compatibility)
const DB_KEY = 'PantryWiseDB_Data';
let memoryDb = null;

const loadDb = () => {
  if (memoryDb) return memoryDb;
  try {
    const stored = localStorage.getItem(DB_KEY);
    if (stored) {
      memoryDb = JSON.parse(stored);
    } else {
      memoryDb = { listItems: [], pantryItems: [], stores: [], priceQuotes: [], recipes: [], wasteLog: [] };
    }
  } catch (e) {
    memoryDb = { listItems: [], pantryItems: [], stores: [], priceQuotes: [], recipes: [], wasteLog: [] };
  }
  return memoryDb;
};

const saveDb = () => {
   try {
     localStorage.setItem(DB_KEY, JSON.stringify(memoryDb));
   } catch (e) {
     console.error("Failed to save to localStorage", e);
   }
};

const mockStore = (storeName) => ({
  toArray: async () => [...(loadDb()[storeName] || [])],
  count: async () => (loadDb()[storeName] || []).length,
  add: async (item) => {
    const dbData = loadDb();
    const id = Date.now().toString(36) + Math.random().toString(36).substr(2); 
    const newItem = { ...item, id };
    if (!dbData[storeName]) dbData[storeName] = [];
    dbData[storeName].push(newItem);
    saveDb();
    return id;
  },
  bulkAdd: async (items) => {
    const dbData = loadDb();
    const newItems = items.map((item, idx) => ({ ...item, id: Date.now().toString(36) + Math.random().toString(36).substr(2) + idx }));
    if (!dbData[storeName]) dbData[storeName] = [];
    dbData[storeName].push(...newItems);
    saveDb();
  },
  update: async (id, changes) => {
    const dbData = loadDb();
    if (!dbData[storeName]) return;
    const index = dbData[storeName].findIndex(i => i.id === id);
    if (index > -1) {
      dbData[storeName][index] = { ...dbData[storeName][index], ...changes };
      saveDb();
    }
  },
  delete: async (id) => {
    const dbData = loadDb();
    if (!dbData[storeName]) return;
    dbData[storeName] = dbData[storeName].filter(i => i.id !== id);
    saveDb();
  }
});

const db = {
  listItems: mockStore('listItems'),
  pantryItems: mockStore('pantryItems'),
  stores: mockStore('stores'),
  priceQuotes: mockStore('priceQuotes'),
  recipes: mockStore('recipes'),
  wasteLog: mockStore('wasteLog'),
};

// Seed data function to populate the app on first load
const seedDatabase = async () => {
  const listCount = await db.listItems.count();
  if (listCount === 0) {
    // Seed Stores
    const store1 = await db.stores.add({ name: 'FreshMart', deliveryFee: 50, freeDeliveryThreshold: 500 });
    const store2 = await db.stores.add({ name: 'LocalBazaar', deliveryFee: 30, freeDeliveryThreshold: 300 });

    // Seed Prices (Mock Quotes)
    const quotes = [
      { itemName: 'Milk 1L', storeId: store1, price: 65 },
      { itemName: 'Milk 1L', storeId: store2, price: 68 },
      { itemName: 'Bread', storeId: store1, price: 45 },
      { itemName: 'Bread', storeId: store2, price: 40 },
      { itemName: 'Eggs 12pcs', storeId: store1, price: 85 },
      { itemName: 'Eggs 12pcs', storeId: store2, price: 80 },
      { itemName: 'Rice 5kg', storeId: store1, price: 350 },
      { itemName: 'Rice 5kg', storeId: store2, price: 380 },
    ];
    await db.priceQuotes.bulkAdd(quotes);

    // Seed Shopping List
    await db.listItems.bulkAdd([
      { name: 'Milk 1L', isChecked: false, priority: 'Need' },
      { name: 'Bread', isChecked: false, priority: 'Need' },
      { name: 'Eggs 12pcs', isChecked: false, priority: 'Want' },
    ]);

    // Seed Pantry (some fresh, some expiring)
    const today = new Date();
    const addDays = (days) => new Date(today.getTime() + days * 86400000).toISOString().split('T')[0];
    
    await db.pantryItems.bulkAdd([
      { name: 'Yogurt', expiryDate: addDays(1), category: 'Fridge' },
      { name: 'Spinach', expiryDate: addDays(-1), category: 'Fridge' }, // Expired
      { name: 'Pasta', expiryDate: addDays(60), category: 'Pantry' },
      { name: 'Tomatoes', expiryDate: addDays(4), category: 'Fridge' },
    ]);

    // Seed Recipes
    await db.recipes.bulkAdd([
      { name: 'Spinach Pasta', ingredients: ['Pasta', 'Spinach', 'Tomatoes'], time: 20 },
      { name: 'Egg Toast', ingredients: ['Eggs 12pcs', 'Bread'], time: 10 },
      { name: 'Tomato Rice', ingredients: ['Rice 5kg', 'Tomatoes'], time: 30 },
    ]);
  }
};

// Helper hook to subscribe to Dexie queries safely without external libraries
function useLiveQuery(queryFn, dependencies = []) {
  const [data, setData] = useState(undefined);
  
  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      try {
        const result = await queryFn();
        if (isMounted) setData(result);
      } catch (error) {
        console.error("Dexie query error:", error);
      }
    };
    fetchData();
    return () => { isMounted = false; };
  }, dependencies);

  return data;
}

// Utility to calculate days until expiry
const getDaysUntil = (dateString) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateString);
  const diffTime = target - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const getExpiryColor = (days) => {
  if (days < 0) return 'text-red-600 bg-red-100 border-red-200';
  if (days <= 2) return 'text-orange-600 bg-orange-100 border-orange-200';
  if (days <= 7) return 'text-amber-600 bg-amber-100 border-amber-200';
  return 'text-emerald-600 bg-emerald-100 border-emerald-200';
};

const HomeView = ({ setTab, refreshTrigger }) => {
  const expiringSoon = useLiveQuery(async () => {
    const items = await db.pantryItems.toArray();
    return items
      .map(item => ({ ...item, days: getDaysUntil(item.expiryDate) }))
      .filter(item => item.days <= 7)
      .sort((a, b) => a.days - b.days);
  }, [refreshTrigger]) || [];

  return (
    <div className="p-4 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Good Morning!</h1>
        <p className="text-gray-500">Here's your pantry overview today.</p>
      </header>

      {/* Budget Snapshot */}
      <section className="bg-emerald-600 rounded-2xl p-5 text-white shadow-lg">
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-semibold text-emerald-100">Trip Budget</h2>
          <Calculator size={20} className="text-emerald-200" />
        </div>
        <div className="text-3xl font-bold mb-4">₹1,200 / ₹2,000</div>
        <div className="w-full bg-emerald-700 rounded-full h-2">
          <div className="bg-white h-2 rounded-full" style={{ width: '60%' }}></div>
        </div>
        <p className="text-sm text-emerald-100 mt-3 flex items-center gap-1">
          <CheckCircle size={14} /> You're on track this week.
        </p>
      </section>

      {/* Expiring Soon Strip */}
      <section>
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-semibold text-gray-800 text-lg">Expiring Soon</h2>
          <button onClick={() => setTab('pantry')} className="text-sm text-emerald-600 font-medium">View All</button>
        </div>
        
        {expiringSoon.length === 0 ? (
          <div className="p-4 bg-gray-50 rounded-xl text-center text-gray-500 text-sm">
            Nothing expiring soon. Great job!
          </div>
        ) : (
          <div className="flex overflow-x-auto gap-3 pb-2 snap-x">
            {expiringSoon.map(item => (
              <div key={item.id} className={`flex-shrink-0 w-36 p-3 rounded-xl border snap-start ${getExpiryColor(item.days)}`}>
                <h3 className="font-semibold truncate">{item.name}</h3>
                <p className="text-sm mt-1 opacity-80">
                  {item.days < 0 ? 'Expired' : item.days === 0 ? 'Today' : `In ${item.days} days`}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setTab('list')} className="p-4 bg-white border rounded-xl shadow-sm flex flex-col items-center gap-2 active:scale-95 transition-transform">
          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
            <ShoppingCart size={20} />
          </div>
          <span className="font-medium text-gray-700">Add to List</span>
        </button>
        <button onClick={() => setTab('recipes')} className="p-4 bg-white border rounded-xl shadow-sm flex flex-col items-center gap-2 active:scale-95 transition-transform">
          <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center">
            <ChefHat size={20} />
          </div>
          <span className="font-medium text-gray-700">Cook Now</span>
        </button>
      </div>
    </div>
  );
};

const ListView = ({ refreshTrigger, onUpdate }) => {
  const [newItem, setNewItem] = useState('');
  const [showOptimizer, setShowOptimizer] = useState(false);
  
  const listItems = useLiveQuery(() => db.listItems.toArray(), [refreshTrigger]) || [];

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newItem.trim()) return;
    await db.listItems.add({ name: newItem.trim(), isChecked: false, priority: 'Need' });
    setNewItem('');
    onUpdate();
  };

  const toggleCheck = async (id, current) => {
    await db.listItems.update(id, { isChecked: !current });
    onUpdate();
  };

  const deleteItem = async (id) => {
    await db.listItems.delete(id);
    onUpdate();
  };

  return (
    <div className="p-4 flex flex-col h-full animate-in fade-in">
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-gray-800">Shopping List</h1>
      </header>

      <form onSubmit={handleAdd} className="flex gap-2 mb-4">
        <input 
          type="text" 
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="Add items (e.g. Apples 1kg)" 
          className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
        />
        <button type="submit" className="bg-emerald-600 text-white p-3 rounded-xl hover:bg-emerald-700 active:scale-95 transition-all">
          <Plus size={24} />
        </button>
      </form>

      <div className="flex-1 overflow-y-auto space-y-2 mb-20">
        {listItems.length === 0 && (
          <div className="text-center text-gray-400 mt-10">Your list is empty</div>
        )}
        {listItems.map(item => (
          <div key={item.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${item.isChecked ? 'bg-gray-50 border-transparent opacity-60' : 'bg-white border-gray-200 shadow-sm'}`}>
            <div className="flex items-center gap-3 flex-1" onClick={() => toggleCheck(item.id, item.isChecked)}>
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${item.isChecked ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300'}`}>
                {item.isChecked && <CheckCircle size={14} className="text-white" />}
              </div>
              <span className={`font-medium ${item.isChecked ? 'line-through text-gray-500' : 'text-gray-800'}`}>{item.name}</span>
            </div>
            <button onClick={() => deleteItem(item.id)} className="text-gray-400 hover:text-red-500 p-2">
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </div>

      {listItems.length > 0 && (
        <div className="fixed bottom-20 left-0 w-full px-4">
          <button 
            onClick={() => setShowOptimizer(true)}
            className="w-full bg-indigo-600 text-white font-semibold py-3.5 rounded-xl shadow-lg flex items-center justify-center gap-2 hover:bg-indigo-700 active:scale-95 transition-all"
          >
            <IndianRupee size={20} />
            Compare & Optimize Basket
          </button>
        </div>
      )}

      {showOptimizer && <OptimizerModal onClose={() => setShowOptimizer(false)} listItems={listItems} />}
    </div>
  );
};

const OptimizerModal = ({ onClose, listItems }) => {
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState([]);

  useEffect(() => {
    const computeOptimizedBasket = async () => {
      setLoading(true);
      // Fetch fresh data for optimization
      const stores = await db.stores.toArray();
      const allQuotes = await db.priceQuotes.toArray();
      
      const unCheckedItems = listItems.filter(i => !i.isChecked);
      
      if (unCheckedItems.length === 0) {
        setPlans([]);
        setLoading(false);
        return;
      }

      // 1. Map list items to available quotes
      const itemQuotes = unCheckedItems.map(item => {
        const quotesForThisItem = allQuotes.filter(q => 
          q.itemName.toLowerCase().includes(item.name.toLowerCase()) || 
          item.name.toLowerCase().includes(q.itemName.toLowerCase())
        );
        return { item, quotes: quotesForThisItem };
      });

      // 2. Evaluate single store plans
      const generatedPlans = [];
      
      stores.forEach(store => {
        let itemsTotal = 0;
        let missing = [];
        let itemsMap = [];

        itemQuotes.forEach(({ item, quotes }) => {
          const storeQuote = quotes.find(q => q.storeId === store.id);
          if (storeQuote) {
            itemsTotal += storeQuote.price;
            itemsMap.push({ itemName: item.name, price: storeQuote.price, store: store.name });
          } else {
            // Missing item logic - for MVP we assign a high arbitrary cost if missing, 
            // or just flag it. Let's assume average market price * 1.2 if missing for simplicity,
            // or just flag as missing.
            missing.push(item.name);
          }
        });

        const deliveryCost = itemsTotal >= store.freeDeliveryThreshold ? 0 : store.deliveryFee;
        const total = itemsTotal + deliveryCost;

        if (missing.length < unCheckedItems.length) { // At least has something
          generatedPlans.push({
            id: `single-${store.id}`,
            title: `Shop only at ${store.name}`,
            storeCount: 1,
            itemsTotal,
            deliveryCost,
            total,
            missing,
            itemsMap,
            reason: `Convenient single-store run. ${deliveryCost === 0 ? 'Qualifies for free delivery!' : `Adds ₹${deliveryCost} delivery fee.`}`
          });
        }
      });

      // 3. Evaluate Split Plan (Cheapest possible item-by-item across all stores)
      let splitItemsTotal = 0;
      let storeTotals = {}; // Track subtotal per store to calculate delivery
      let splitMissing = [];
      let splitItemsMap = [];

      itemQuotes.forEach(({ item, quotes }) => {
        if (quotes.length === 0) {
          splitMissing.push(item.name);
          return;
        }
        // Find cheapest quote
        const bestQuote = quotes.reduce((prev, curr) => prev.price < curr.price ? prev : curr);
        const store = stores.find(s => s.id === bestQuote.storeId);
        
        splitItemsTotal += bestQuote.price;
        storeTotals[store.id] = (storeTotals[store.id] || 0) + bestQuote.price;
        splitItemsMap.push({ itemName: item.name, price: bestQuote.price, store: store.name });
      });

      let splitDeliveryTotal = 0;
      let storesUsed = 0;
      stores.forEach(store => {
        if (storeTotals[store.id]) {
          storesUsed++;
          if (storeTotals[store.id] < store.freeDeliveryThreshold) {
            splitDeliveryTotal += store.deliveryFee;
          }
        }
      });

      const splitTotal = splitItemsTotal + splitDeliveryTotal;

      if (storesUsed > 1) {
        generatedPlans.push({
          id: 'optimized-split',
          title: 'Cheapest Split Basket',
          storeCount: storesUsed,
          itemsTotal: splitItemsTotal,
          deliveryCost: splitDeliveryTotal,
          total: splitTotal,
          missing: splitMissing,
          itemsMap: splitItemsMap,
          reason: `Saves on item prices, but check if the extra ₹${splitDeliveryTotal} delivery fees outweigh the savings.`
        });
      }

      // Sort by total cost
      generatedPlans.sort((a, b) => a.total - b.total);
      
      // Simulate network delay for effect
      setTimeout(() => {
        setPlans(generatedPlans.slice(0, 3)); // Top 3 plans
        setLoading(false);
      }, 800);
    };

    computeOptimizedBasket();
  }, [listItems]);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex flex-col justify-end">
      <div className="bg-gray-50 w-full h-[85vh] rounded-t-3xl shadow-2xl flex flex-col animate-in slide-in-from-bottom-full duration-300">
        <div className="flex justify-between items-center p-5 bg-white rounded-t-3xl border-b sticky top-0 z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Basket Optimizer</h2>
            <p className="text-sm text-gray-500">Finding the best value</p>
          </div>
          <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4 text-emerald-600">
              <Calculator size={48} className="animate-bounce" />
              <p className="font-medium animate-pulse">Crunching prices & delivery fees...</p>
            </div>
          ) : plans.length === 0 ? (
            <div className="text-center text-gray-500 mt-10">
              <AlertTriangle size={48} className="mx-auto mb-4 text-amber-400" />
              <p>Not enough data to optimize.</p>
              <p className="text-sm">Try adding standard items like Milk, Bread, or Eggs.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {plans.map((plan, index) => (
                <div key={plan.id} className={`p-4 rounded-2xl border-2 ${index === 0 ? 'border-emerald-500 bg-emerald-50/50 shadow-md' : 'border-transparent bg-white shadow-sm'}`}>
                  {index === 0 && <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full mb-2 tracking-wide uppercase">Best Value</span>}
                  
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-bold text-lg text-gray-800">{plan.title}</h3>
                    <div className="text-right">
                      <div className="text-2xl font-extrabold text-indigo-700">₹{plan.total}</div>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-4 bg-white/50 p-2 rounded-lg border border-gray-100">
                    {plan.reason}
                  </p>

                  <div className="bg-gray-50 rounded-xl p-3 text-sm space-y-2 border border-gray-100">
                    <div className="flex justify-between text-gray-600">
                      <span>Items Subtotal:</span>
                      <span className="font-medium">₹{plan.itemsTotal}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Delivery Fees:</span>
                      <span className="font-medium text-rose-500">+₹{plan.deliveryCost}</span>
                    </div>
                    {plan.missing.length > 0 && (
                      <div className="flex justify-between text-amber-600 pt-2 border-t border-gray-200 mt-2">
                        <span>Missing items:</span>
                        <span className="font-medium">{plan.missing.length}</span>
                      </div>
                    )}
                  </div>
                  
                  <button className="w-full mt-4 bg-gray-900 text-white py-3 rounded-xl font-medium hover:bg-gray-800 active:scale-95 transition-all">
                    Select this plan
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const PantryView = ({ refreshTrigger, onUpdate }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', days: 7 });

  const pantryItems = useLiveQuery(() => db.pantryItems.toArray(), [refreshTrigger]) || [];

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newItem.name.trim()) return;
    
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + parseInt(newItem.days));
    
    await db.pantryItems.add({
      name: newItem.name.trim(),
      expiryDate: expiryDate.toISOString().split('T')[0],
      category: 'Pantry'
    });
    
    setNewItem({ name: '', days: 7 });
    setShowAdd(false);
    onUpdate();
  };

  const handleAction = async (id, name, isWaste) => {
    if (isWaste) {
      await db.wasteLog.add({
        date: new Date().toISOString(),
        itemName: name,
        cost: 50 // Mock estimated cost for MVP
      });
    }
    await db.pantryItems.delete(id);
    onUpdate();
  };

  // Group items by urgency
  const sortedItems = pantryItems
    .map(item => ({ ...item, daysLeft: getDaysUntil(item.expiryDate) }))
    .sort((a, b) => a.daysLeft - b.daysLeft);

  return (
    <div className="p-4 flex flex-col h-full animate-in fade-in">
      <header className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">My Pantry</h1>
          <p className="text-gray-500 text-sm">{pantryItems.length} items stored</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="p-3 bg-emerald-100 text-emerald-700 rounded-full active:bg-emerald-200">
          {showAdd ? <X size={20} /> : <Plus size={20} />}
        </button>
      </header>

      {showAdd && (
        <form onSubmit={handleAdd} className="bg-white p-4 rounded-2xl shadow-sm border border-emerald-100 mb-6 animate-in slide-in-from-top-2">
          <h3 className="font-semibold mb-3 text-gray-700">Add to Pantry</h3>
          <input 
            type="text" 
            placeholder="Item name (e.g. Yogurt)" 
            value={newItem.name}
            onChange={e => setNewItem({...newItem, name: e.target.value})}
            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl mb-3 focus:ring-2 focus:ring-emerald-500 outline-none"
            required
          />
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
            {[3, 7, 14, 30].map(days => (
              <button 
                type="button"
                key={days}
                onClick={() => setNewItem({...newItem, days})}
                className={`px-4 py-2 rounded-lg text-sm font-medium flex-shrink-0 transition-colors ${newItem.days === days ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'}`}
              >
                +{days} days
              </button>
            ))}
          </div>
          <button type="submit" className="w-full bg-emerald-600 text-white p-3 rounded-xl font-medium">
            Save Item
          </button>
        </form>
      )}

      <div className="flex-1 overflow-y-auto space-y-3 pb-20">
        {sortedItems.length === 0 ? (
          <div className="text-center text-gray-400 mt-10">Pantry is empty</div>
        ) : (
          sortedItems.map(item => (
            <div key={item.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-800">{item.name}</h3>
                <span className={`text-xs px-2 py-1 rounded-md mt-1 inline-block font-medium ${getExpiryColor(item.daysLeft)}`}>
                  {item.daysLeft < 0 ? 'Expired' : item.daysLeft === 0 ? 'Expiring today' : `Expires in ${item.daysLeft} days`}
                </span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleAction(item.id, item.name, false)} className="p-2 text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100" title="Mark as used">
                  <CheckCircle size={18} />
                </button>
                <button onClick={() => handleAction(item.id, item.name, true)} className="p-2 text-amber-600 bg-amber-50 rounded-lg hover:bg-amber-100" title="Wasted">
                  <AlertTriangle size={18} />
                </button>
                <button onClick={() => handleAction(item.id, item.name, false)} className="p-2 text-gray-400 bg-gray-50 rounded-lg hover:bg-gray-100 hover:text-red-500" title="Delete">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const RecipesView = ({ refreshTrigger, onUpdate }) => {
  const pantryItems = useLiveQuery(() => db.pantryItems.toArray(), [refreshTrigger]) || [];
  const allRecipes = useLiveQuery(() => db.recipes.toArray(), []) || [];

  const pantryNames = pantryItems.map(i => i.name.toLowerCase());

  const handleAddMissing = async (recipe) => {
    // 1. Find which ingredients from the recipe are not in the pantry
    const missingIngredients = recipe.ingredients.filter(ing => {
      return !pantryNames.some(p => p.includes(ing.toLowerCase()) || ing.toLowerCase().includes(p));
    });
    
    // 2. Add them to the shopping list DB
    for (const ing of missingIngredients) {
      await db.listItems.add({ name: ing, isChecked: false, priority: 'Need' });
    }
    
    // 3. Trigger a re-render so the rest of the app updates
    if (onUpdate) onUpdate();
  };

  // Calculate match percentage and boost if using expiring items
  const recipesWithScores = allRecipes.map(recipe => {
    let matchCount = 0;
    let boost = 0;
    
    recipe.ingredients.forEach(ing => {
      const pItem = pantryItems.find(p => p.name.toLowerCase().includes(ing.toLowerCase()) || ing.toLowerCase().includes(p.name.toLowerCase()));
      if (pItem) {
        matchCount++;
        const daysLeft = getDaysUntil(pItem.expiryDate);
        if (daysLeft <= 3) boost += 2; // High boost for urgent items
        else if (daysLeft <= 7) boost += 1; // Minor boost
      }
    });

    const matchPercentage = (matchCount / recipe.ingredients.length) * 100;
    const finalScore = matchPercentage + (boost * 10);

    return { ...recipe, matchPercentage, finalScore, matchCount };
  }).sort((a, b) => b.finalScore - a.finalScore);

  return (
    <div className="p-4 flex flex-col h-full animate-in fade-in">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Smart Recipes</h1>
        <p className="text-gray-500 text-sm">Based on what you have & what's expiring</p>
      </header>

      <div className="flex-1 overflow-y-auto space-y-4 pb-20">
        {recipesWithScores.map((recipe, idx) => (
          <div key={recipe.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm relative overflow-hidden">
            {idx === 0 && recipe.finalScore > 50 && (
              <div className="absolute top-0 right-0 bg-amber-400 text-amber-900 text-xs font-bold px-3 py-1 rounded-bl-lg flex items-center gap-1">
                <Clock size={12} /> Saves Expiring Food
              </div>
            )}
            <h3 className="font-bold text-lg text-gray-800 mb-1 mt-2">{recipe.name}</h3>
            
            <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
              <span className="flex items-center gap-1"><Clock size={14} /> {recipe.time} mins</span>
              <span className="flex items-center gap-1 text-emerald-600 font-medium">
                <CheckCircle size={14} /> {recipe.matchCount}/{recipe.ingredients.length} ingredients
              </span>
            </div>

            <div className="bg-gray-50 rounded-xl p-3">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Ingredients</h4>
              <ul className="text-sm space-y-1">
                {recipe.ingredients.map(ing => {
                  const hasIng = pantryNames.some(p => p.includes(ing.toLowerCase()) || ing.toLowerCase().includes(p));
                  return (
                    <li key={ing} className={`flex items-center gap-2 ${hasIng ? 'text-gray-800' : 'text-gray-400'}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${hasIng ? 'bg-emerald-500' : 'bg-gray-300'}`}></div>
                      {ing} {hasIng ? '' : '(missing)'}
                    </li>
                  )
                })}
              </ul>
            </div>
            
            {recipe.matchCount < recipe.ingredients.length && (
              <button 
                onClick={() => handleAddMissing(recipe)}
                className="w-full mt-4 py-2 bg-indigo-50 text-indigo-700 font-medium rounded-xl text-sm active:bg-indigo-100 hover:bg-indigo-100 transition-colors"
              >
                Add missing to list
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const SavingsView = ({ refreshTrigger }) => {
  const wasteLog = useLiveQuery(() => db.wasteLog.toArray(), [refreshTrigger]) || [];
  
  const totalWasted = wasteLog.reduce((acc, curr) => acc + curr.cost, 0);
  const mockSaved = 840; // Mock derived savings from optimizer usage over time

  return (
    <div className="p-4 flex flex-col h-full animate-in fade-in">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Your Impact</h1>
        <p className="text-gray-500 text-sm">Monthly summary</p>
      </header>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-100 flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-2">
            <IndianRupee size={24} />
          </div>
          <span className="text-sm text-emerald-800 font-medium mb-1">Money Saved</span>
          <span className="text-2xl font-black text-emerald-600">₹{mockSaved}</span>
        </div>
        
        <div className="bg-rose-50 p-5 rounded-2xl border border-rose-100 flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-2">
            <Trash2 size={24} />
          </div>
          <span className="text-sm text-rose-800 font-medium mb-1">Food Wasted</span>
          <span className="text-2xl font-black text-rose-600">₹{totalWasted}</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 border shadow-sm">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <LineChart size={20} className="text-indigo-600" /> Waste History
        </h3>
        {wasteLog.length === 0 ? (
          <div className="text-center text-gray-400 py-6">No waste logged yet. Great job!</div>
        ) : (
          <div className="space-y-3">
            {wasteLog.slice().reverse().map(log => (
              <div key={log.id} className="flex justify-between items-center text-sm border-b pb-2 last:border-0">
                <div>
                  <span className="font-medium text-gray-700">{log.itemName}</span>
                  <p className="text-xs text-gray-400">{new Date(log.date).toLocaleDateString()}</p>
                </div>
                <span className="text-rose-600 font-medium">₹{log.cost}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isPwaSimulated, setIsPwaSimulated] = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(true);

  const triggerUpdate = () => setRefreshTrigger(prev => prev + 1);

  useEffect(() => {
    // Initialize DB and seed
    seedDatabase().then(() => triggerUpdate());

    // Inject simulated PWA meta tags dynamically for completeness
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = '#059669';
    document.head.appendChild(meta);
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'home': return <HomeView setTab={setActiveTab} refreshTrigger={refreshTrigger} />;
      case 'list': return <ListView refreshTrigger={refreshTrigger} onUpdate={triggerUpdate} />;
      case 'pantry': return <PantryView refreshTrigger={refreshTrigger} onUpdate={triggerUpdate} />;
      case 'recipes': return <RecipesView refreshTrigger={refreshTrigger} onUpdate={triggerUpdate} />;
      case 'savings': return <SavingsView refreshTrigger={refreshTrigger} />;
      default: return <HomeView setTab={setActiveTab} refreshTrigger={refreshTrigger} />;
    }
  };

  const navItems = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'list', icon: ShoppingCart, label: 'List' },
    { id: 'pantry', icon: Archive, label: 'Pantry' },
    { id: 'recipes', icon: ChefHat, label: 'Recipes' },
    { id: 'savings', icon: LineChart, label: 'Savings' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center font-sans text-gray-900 selection:bg-emerald-200">
      {/* Mobile container constraint for desktop viewing */}
      <div className="w-full max-w-md bg-white h-screen flex flex-col relative shadow-2xl overflow-hidden">
        
        {/* Mock PWA Install Banner */}
        {showInstallBanner && (
          <div className="bg-indigo-600 text-white p-3 flex justify-between items-center z-50">
            <div className="flex items-center gap-3">
              <div className="bg-white rounded-lg p-1">
                <Smartphone className="text-indigo-600" size={20} />
              </div>
              <div className="text-sm">
                <p className="font-bold leading-tight">Install PantryWise</p>
                <p className="text-indigo-200 text-xs">Add to Home Screen for offline use</p>
              </div>
            </div>
            <button onClick={() => setShowInstallBanner(false)} className="text-indigo-200 hover:text-white p-2">
              <X size={18} />
            </button>
          </div>
        )}

        {/* Top Safe Area / Status Bar space simulation */}
        <div className="h-safe-top bg-white"></div>

        {/* Main scrollable content area */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto relative">
          {renderContent()}
        </main>

        {/* Bottom Navigation Bar */}
        <nav className="border-t bg-white pb-safe-bottom">
          <div className="flex justify-around items-center h-16 px-2">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${isActive ? 'text-emerald-600' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <div className={`p-1 rounded-full transition-all duration-300 ${isActive ? 'bg-emerald-50' : 'bg-transparent'}`}>
                    <Icon size={isActive ? 24 : 22} strokeWidth={isActive ? 2.5 : 2} />
                  </div>
                  <span className="text-[10px] font-medium tracking-wide">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}