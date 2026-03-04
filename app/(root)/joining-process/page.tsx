'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useRouter } from 'next/navigation';

export default function JoiningProcessPage() {
  const [selectedGrade, setSelectedGrade] = useState('B1');
  const { data: session } = useSession();
  const user = useQuery(api.user.getUserByContact, { contact: (session as any)?.user?.contact || '' });
  const router = useRouter();

  const grades = [
    { grade: 'A1', equipment: 20, daily: 2, monthly: 60, annual: 730 },
    { grade: 'A2', equipment: 100, daily: 6.6, monthly: 198, annual: 2409 },
    { grade: 'A3', equipment: 380, daily: 25, monthly: 750, annual: 9125 },
    { grade: 'B1', equipment: 780, daily: 52, monthly: 1560, annual: 18980 },
    { grade: 'B2', equipment: 1800, daily: 120, monthly: 3600, annual: 43800 },
    { grade: 'B3', equipment: 4800, daily: 320, monthly: 9600, annual: 116800 },
    { grade: 'S1', equipment: 12800, daily: 853, monthly: 25590, annual: 311345 },
    { grade: 'S2', equipment: 25800, daily: 1720, monthly: 51600, annual: 627800 },
    { grade: 'S3', equipment: 58000, daily: 3850, monthly: 115500, annual: 1405250 },
    { grade: 'SS', equipment: 128000, daily: 8530, monthly: 255900, annual: 3113450 },
    { grade: 'SSS', equipment: 280000, daily: 18600, monthly: 558000, annual: 6789000 },
  ];

  const [depositModal, setDepositModal] = useState<{ open: boolean; required?: number }>({ open: false });

  const onRequestDeposit = (required: number) => {
    setDepositModal({ open: true, required });
  };

  const closeDepositModal = () => setDepositModal({ open: false });

  const goToDeposit = () => {
    if (!depositModal.required) return;
    const q = new URLSearchParams({ amount: String(depositModal.required) });
    router.push('/deposit?' + q.toString());
    setDepositModal({ open: false });
  };

  function DeviceCard({ item, userBalance, onRequestDeposit, isSignedIn }: { item: { grade: string; equipment: number; daily: number }, userBalance?: number, onRequestDeposit: (required: number) => void, isSignedIn: boolean }) {
    const storageKey = `andes_device_${item.grade}`;
    const [count, setCount] = useState<number>(1);
    const [deposit, setDeposit] = useState<number>(0);
    const [active, setActive] = useState<boolean>(false);

    useEffect(() => {
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          setCount(parsed.count || 1);
          setDeposit(parsed.deposit || 0);
          setActive(!!parsed.active);
        }
      } catch (e) {}
    }, [storageKey]);

    useEffect(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify({ count, deposit, active }));
      } catch (e) {}
    }, [count, deposit, active, storageKey]);

    const required = item.equipment * count;

    const handleStartTask = () => {
      // Check if user is signed in
      if (!isSignedIn) {
        router.push('/sign-in');
        return;
      }

      // If deposit input was used and meets required, activate
      if (deposit >= required) return setActive(true);

      // Otherwise check user balance and request parent to show deposit modal
      const balance = userBalance ?? 0;
      if (balance >= required) {
        setActive(true);
        return;
      }

      // Ask parent to open deposit modal with required amount
      onRequestDeposit(required);
    };

    return (
      <div className="bg-gradient-to-br from-green-200 to-cyan-200 rounded-lg p-6 shadow-md">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center">
            <Image src="/scooter.png" alt="Scooter" width={64} height={64} />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-lg">{item.grade} — Daily: {item.daily}</h4>
              <div className="text-sm text-gray-700">Daily profit of a single device: {item.daily}</div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="bg-white rounded p-3 text-center">
                <div className="text-sm text-gray-500">Device price</div>
                <div className="font-bold text-xl">{item.equipment}</div>
              </div>

              <div className="bg-white rounded p-3 text-center">
                <div className="text-sm text-gray-500">Number of devices</div>
                <div className="flex items-center justify-center gap-3 mt-2">
                  <button onClick={() => setCount((c) => Math.max(1, c - 1))} className="px-2 py-1 bg-gray-200 rounded">-</button>
                  <div className="font-semibold">{count}</div>
                  <button onClick={() => setCount((c) => c + 1)} className="px-2 py-1 bg-gray-200 rounded">+</button>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-4">
              <div className="flex-1">
                <div className="text-sm text-gray-600">Required deposit</div>
                <div className="font-bold">{required} USDT</div>
              </div>

              <div className="w-40">
                <input
                  type="number"
                  min={0}
                  value={deposit}
                  onChange={(e) => setDeposit(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded border"
                  placeholder="Deposit"
                />
              </div>


              <div>
                {!active ? (
                  <button
                    onClick={handleStartTask}
                    className={`px-4 py-2 rounded font-semibold ${deposit >= required ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-700'}`}
                  >
                    Start
                  </button>
                ) : (
                  <button
                    onClick={() => setActive(false)}
                    className="px-4 py-2 rounded bg-red-500 text-white font-semibold"
                  >
                    Stop
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="font-montserrat text-gray-800 overflow-x-hidden bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 flex justify-between items-center px-[5%] py-6 bg-white/95 backdrop-blur-lg z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <img src="https://images.unsplash.com/photo-1589828876954-ec07463ac0e6?w=50&q=80" alt="ANDES Logo" className="w-12 h-12 object-contain" />
          <span className="font-playfair text-2xl font-bold text-gray-800">ANDES</span>
        </div>
        <ul className="hidden md:flex gap-10 list-none">
          <li><Link href="/" className="text-gray-800 font-medium text-sm hover:text-cyan-500">Home</Link></li>
          <li><Link href="/about" className="text-gray-800 font-medium text-sm hover:text-cyan-500">About Us</Link></li>
          <li><Link href="/anti-fraud" className="text-gray-800 font-medium text-sm hover:text-cyan-500">Anti-fraud</Link></li>
          <li><Link href="/occupation" className="text-gray-800 font-medium text-sm hover:text-cyan-500">Occupation</Link></li>
          <li><Link href="/joining-process" className="text-gray-800 font-semibold text-sm border-b-2 border-gray-800">Joining process</Link></li>
        </ul>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-24 pb-0 overflow-hidden bg-gradient-to-br from-cyan-300 via-blue-400 to-purple-400">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-10 left-10 w-32 h-32 bg-green-300 rounded-full"></div>
          <div className="absolute top-40 right-20 w-40 h-40 bg-blue-300 rounded-full opacity-50"></div>
        </div>
        <div className="relative z-10 max-w-7xl mx-auto text-center px-6 py-16">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">Join</h1>
          <p className="text-xl md:text-2xl text-white">Start your journey with ANDES</p>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-20 px-[5%] bg-white">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center text-gray-900 mb-2">ANDES PRICE LIST</h2>
          <p className="text-lg text-center text-cyan-500 mb-12">Investment packages and daily income</p>

          {/* Price Table */}
          <div className="overflow-x-auto mb-16">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-cyan-500">
                  <th className="border border-cyan-500 px-6 py-4 text-white font-bold text-left">Grade</th>
                  <th className="border border-cyan-500 px-6 py-4 text-white font-bold text-center">Equipment cost ($USD)</th>
                  <th className="border border-cyan-500 px-6 py-4 text-white font-bold text-center">Daily income ($USD)</th>
                  <th className="border border-cyan-500 px-6 py-4 text-white font-bold text-center">30-day income ($USD)</th>
                  <th className="border border-cyan-500 px-6 py-4 text-white font-bold text-center">365 days income ($USD)</th>
                </tr>
              </thead>
              <tbody>
                {grades.map((item, idx) => (
                  <tr
                    key={item.grade}
                    className={`cursor-pointer transition-colors ${
                      selectedGrade === item.grade ? 'bg-cyan-100' : idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'
                    }`}
                    onClick={() => setSelectedGrade(item.grade)}
                  >
                    <td className="border border-gray-300 px-6 py-4 font-bold text-gray-800">{item.grade}</td>
                    <td className="border border-gray-300 px-6 py-4 text-center text-gray-700">{item.equipment.toLocaleString()}</td>
                    <td className="border border-gray-300 px-6 py-4 text-center text-gray-700">{item.daily.toLocaleString()}</td>
                    <td className="border border-gray-300 px-6 py-4 text-center text-gray-700">{item.monthly.toLocaleString()}</td>
                    <td className="border border-gray-300 px-6 py-4 text-center text-gray-700">{item.annual.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Rebate Information */}
          <div className="bg-cyan-500 text-white p-6 rounded-lg mb-16">
            <p className="text-lg font-semibold mb-2">💰 Referral Rebate Program:</p>
            <ul className="text-base space-y-2">
              <li>✓ First-level subordinate recharge rebate: 18%</li>
              <li>✓ Second-level subordinate recharge rebate: 3%</li>
              <li>✓ Third-level subordinate recharge rebate: 2%</li>
            </ul>
          </div>

          {/* Device Cards (Join) */}
          <div className="grid grid-cols-1 gap-6 mb-12">
            {grades.slice(0, 6).map((item) => (
              <DeviceCard
                key={item.grade}
                item={item}
                userBalance={user?.depositAmount}
                onRequestDeposit={onRequestDeposit}
                isSignedIn={!!session?.user}
              />
            ))}
          </div>

          {/* Deposit Modal */}
          {depositModal.open && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="bg-white rounded-xl p-8 max-w-md w-full">
                <h3 className="text-xl font-bold mb-4">Insufficient Balance</h3>
                <p className="mb-4">You need <strong>{depositModal.required} USDT</strong> (TRC20) to start. Would you like to deposit now?</p>
                <div className="flex gap-4 justify-end">
                  <button onClick={closeDepositModal} className="px-4 py-2 rounded bg-gray-200">Cancel</button>
                  <button onClick={goToDeposit} className="px-4 py-2 rounded bg-cyan-600 text-white">Go to Deposit</button>
                </div>
              </div>
            </div>
          )}

          {/* Modal placeholder will be rendered by DeviceCard via prop drilling (implemented below) */}

          {/* Instructions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-8 shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">(1) Registration Instructions</h3>
              <ol className="space-y-3 text-gray-700 list-decimal list-inside">
                <li className="text-cyan-600">Fill in your mobile phone number, login password, withdrawal password according to the conditions.</li>
                <li className="text-cyan-600">Please remember the password you entered</li>
              </ol>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-8 shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">(2) ① Recharge Instructions</h3>
              <ol className="space-y-3 text-gray-700 list-decimal list-inside">
                <li className="text-green-600">The minimum deposit amount is 20USDT. If the deposit amount is lower than the minimum, the deposit will not be credited.</li>
              </ol>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-8 shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">(2) ② Recharge Instructions</h3>
              <ol className="space-y-3 text-gray-700 list-decimal list-inside">
                <li className="text-green-600">Please select the corresponding network to deposit. Otherwise, it cannot be retrieved.</li>
                <li className="text-green-600">Your deposit address will not change frequently. If there is any change, we will notify you through the APP announcement.</li>
              </ol>
            </div>
          </div>

          {/* More Instructions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-8 shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">(3) ① Withdrawal Instructions</h3>
              <p className="text-gray-700 leading-relaxed text-purple-600">Select the network you want to withdraw funds from and add your wallet address.</p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-8 shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">(3) ② Withdrawal Instructions</h3>
              <p className="text-gray-700 leading-relaxed text-purple-600">Select the withdrawal address network and fill in the withdrawal password. Please select the correct network to withdraw funds according to your wallet address. Otherwise, we are not responsible if the funds are not received.</p>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-8 shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">(4) ① Equipment working instructions</h3>
              <p className="text-gray-700 leading-relaxed text-orange-600">According to your funds, select the equipment you want to invest in and click to purchase the project.</p>
            </div>
          </div>

          {/* Additional Equipment Instructions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-8 shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">(4) ② Equipment working instructions</h3>
              <ol className="space-y-3 text-gray-700 list-decimal list-inside">
                <li className="text-orange-600">Click to start working and you can get the income after 1 minute.</li>
                <li className="text-orange-600">Click the running status to collect today's income with one click.</li>
              </ol>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-8 shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">(4) ③ Equipment working instructions</h3>
              <p className="text-gray-700 leading-relaxed text-orange-600">Please note that if you do not receive today's equipment income, it will not be credited to your account. Please collect it in time with one click.</p>
            </div>
          </div>

          {/* Promotion Instructions */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-16">
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl p-8 shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">(5) ① Promotion Instructions</h3>
              <p className="text-gray-700 leading-relaxed text-indigo-600">Click the share window and copy your share link.</p>
            </div>

            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl p-8 shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">(5) ② Promotion Instructions</h3>
              <p className="text-gray-700 leading-relaxed text-indigo-600">When your subordinates deposit money, you can get 18% commission from A, 2% commission from B, 1% commission from C, and more extra rewards are waiting for you.</p>
            </div>

            <div className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-2xl p-8 shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">(6) ① As shown in the picture</h3>
              <p className="text-gray-700 leading-relaxed text-teal-600">Get online customer service and App download</p>
            </div>

            <div className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-2xl p-8 shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">(6) ② As shown in the picture</h3>
              <p className="text-gray-700 leading-relaxed text-teal-600">Get online customer service and App download</p>
            </div>
          </div>

          {/* Team Description */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20">
            <div className="bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl p-8 shadow-2xl text-white">
              <h3 className="text-3xl font-bold mb-4">(7) ① Team Description</h3>
              <p className="text-lg leading-relaxed">Click on the picture to get the level information of your subordinates.</p>
            </div>

            <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl p-8 shadow-2xl text-white">
              <h3 className="text-3xl font-bold mb-4">(7) ② Team Description</h3>
              <p className="text-lg leading-relaxed">Click on the picture to get the level information of your subordinates.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Agent Salary Section */}
      <section className="py-20 px-[5%] bg-gradient-to-br from-blue-50 to-cyan-50">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-16">
            {/* Table */}
            <div className="bg-white rounded-2xl shadow-2xl p-8">
              <h3 className="text-3xl font-bold text-center text-gray-900 mb-6">ANDES Agent Salary</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white">
                    <tr>
                      <th className="border border-blue-300 p-3 text-left">Agent Level</th>
                      <th className="border border-blue-300 p-3 text-center">Team Members</th>
                      <th className="border border-blue-300 p-3 text-center">Weekly Salary</th>
                      <th className="border border-blue-300 p-3 text-center">Monthly Allowance</th>
                      <th className="border border-blue-300 p-3 text-center">Rewards</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Level 1', '10', '25 USDT', '200 USDT', '0'],
                      ['Level 2', '30', '80 USDT', '500 USDT', '0'],
                      ['Level 3', '100', '250 USDT', '1500 USDT', '1000 USDT'],
                      ['Level 4', '500', '1250 USDT', '4000 USDT', 'Sedan'],
                    ].map((row, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-blue-50'}>
                        {row.map((cell, j) => (
                          <td key={j} className={j === 0 ? 'border border-gray-300 p-3 font-semibold' : 'border border-gray-300 p-3 text-center'}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Instructions */}
            <div>
              <h3 className="text-4xl font-bold text-gray-900 mb-6">How to Become Captain</h3>
              <div className="space-y-4 mb-8">
                <p className="text-lg text-gray-700"><strong>1.</strong> Purchase 10 people + A2 equipment to qualify</p>
                <p className="text-lg text-gray-700"><strong>2.</strong> Wages paid every Sunday + monthly team building budget</p>
              </div>
              <div className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl p-6 shadow-lg">
                <p className="text-lg leading-relaxed">Contact the manager to apply to become an agent after meeting requirements.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Price List Section */}
      <section className="py-20 px-[5%] bg-white">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-5xl font-bold text-gray-900 mb-12 text-center">ANDES PRICE LIST</h2>

          {/* Pricing Table */}
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-8 shadow-2xl mb-8 overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white">
                <tr>
                  <th className="border border-blue-300 p-4 text-left">Grade</th>
                  <th className="border border-blue-300 p-4 text-center">Price</th>
                  <th className="border border-blue-300 p-4 text-center">Daily Income</th>
                  <th className="border border-blue-300 p-4 text-center">30-day Income</th>
                  <th className="border border-blue-300 p-4 text-center">365-day Income</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['A1', '20', '2', '60', '730'],
                  ['A2', '100', '6.6', '198', '2409'],
                  ['A3', '380', '25', '750', '9125'],
                  ['B1', '780', '52', '1560', '18980'],
                  ['B2', '1800', '120', '3600', '43800'],
                  ['B3', '4800', '320', '9600', '116800'],
                  ['S1', '12800', '853', '25590', '311345'],
                  ['S2', '25800', '1720', '51600', '627800'],
                  ['S3', '58000', '3850', '115500', '1405250'],
                  ['SS', '128000', '8530', '255900', '3113450'],
                  ['SSS', '280000', '18600', '558000', '6789000'],
                ].map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-blue-50'}>
                    <td className="border border-gray-300 p-4 font-bold text-blue-600">{row[0]}</td>
                    {row.slice(1).map((cell, j) => (
                      <td key={j} className="border border-gray-300 p-4 text-center">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Commission Structure */}
          <div className="bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl p-8 shadow-2xl text-white text-center mb-8 space-y-4 text-xl">
            <p className="font-bold">First-level subordinate: 18%</p>
            <p className="font-bold">Second-level subordinate: 3%</p>
            <p className="font-bold">Third-level subordinate: 2%</p>
          </div>

          {/* Additional Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-8 shadow-lg">
              <h4 className="text-2xl font-bold text-gray-900 mb-2">⏰ Daily Update</h4>
              <p className="text-lg text-gray-700">10:00 am New York time (USA)</p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-8 shadow-lg">
              <h4 className="text-2xl font-bold text-gray-900 mb-4">💰 Requirements</h4>
              <ul className="space-y-2 text-gray-700">
                <li>💵 Minimum deposit: 20 USDT</li>
                <li>💵 Minimum withdrawal: 1 USDT</li>
              </ul>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-8 shadow-lg">
              <h4 className="text-2xl font-bold text-gray-900 mb-2">⏱️ Validity</h4>
              <p className="text-lg text-gray-700">Each level valid for 365 days</p>
            </div>

            <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-8 shadow-lg">
              <h4 className="text-2xl font-bold text-gray-900 mb-2">💸 Withdrawals</h4>
              <p className="text-lg text-gray-700">Free, credited within 1-3 minutes</p>
            </div>
          </div>

          {/* Supported Networks */}
          <div className="mt-8 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl p-8 shadow-2xl text-white text-center">
            <h4 className="text-2xl font-bold mb-4">Supported Payment Networks</h4>
            <p className="text-xl">💎 TRC20 (Tron) 💎</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 px-[5%]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h4 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <img src="https://images.unsplash.com/photo-1589828876954-ec07463ac0e6?w=50&q=80" alt="Logo" className="w-8 h-8" />
              ANDES
            </h4>
            <p className="text-gray-400 text-sm">Global Sharing Economy Platform</p>
          </div>

          <div>
            <h4 className="font-semibold text-lg mb-4">Quick Links</h4>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li><Link href="/" className="hover:text-cyan-500">Home</Link></li>
              <li><Link href="/about" className="hover:text-cyan-500">About Us</Link></li>
              <li><Link href="/joining-process" className="hover:text-cyan-500">Join Us</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-lg mb-4">Support</h4>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li><Link href="#" className="hover:text-cyan-500">FAQ</Link></li>
              <li><Link href="#" className="hover:text-cyan-500">Contact</Link></li>
              <li><Link href="#" className="hover:text-cyan-500">Privacy Policy</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-lg mb-4">Connect</h4>
            <p className="text-gray-400 text-sm mb-4">Follow us</p>
            <div className="flex gap-4">
              {['f', 't', 'in'].map((icon) => (
                <Link key={icon} href="#" className="w-10 h-10 bg-cyan-500 rounded-full flex items-center justify-center hover:bg-cyan-600 text-white font-bold">
                  {icon}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400 text-sm">
          <p>&copy; 2026 ANDES. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
