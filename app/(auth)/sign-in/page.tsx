"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import SupportChat from "@/components/SupportChat";
import { ALLOWED_COUNTRY_CODES } from "@/constants/countryCodes";
import { parsePhoneNumberFromString } from 'libphonenumber-js';
export default function SignInPage() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [countryCode, setCountryCode] = useState("+1");
  const [password, setPassword] = useState("");
  const [language, setLanguage] = useState("en");
  const [locationCountry, setLocationCountry] = useState<string | null>(null);
  const [phoneCountryDetected, setPhoneCountryDetected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Validation states
  const [locationMismatch, setLocationMismatch] = useState<boolean | null>(null);

  // Browser geolocation + reverse geocoding helpers
  const reverseGeocode = async (lat: number, lon: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`
      );
      if (!res.ok) return null;
      const json = await res.json();
      const cc = json?.address?.country_code;
      return cc ? cc.toUpperCase() : null;
    } catch (e) {
      return null;
    }
  };

  const getCurrentPositionAsync = () =>
    new Promise<GeolocationPosition>((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 })
    );

  React.useEffect(() => {
    (async () => {
      if (typeof window !== "undefined" && 'geolocation' in navigator) {
        try {
          const pos = await getCurrentPositionAsync();
          const cc = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
          if (cc) setLocationCountry(cc);
        } catch (err) {
          // ignore; fallback to IP lookup on submit
        }
      }
    })();
  }, []);
  const [phoneValid, setPhoneValid] = useState<boolean | null>(null);
  const [passwordValid, setPasswordValid] = useState<boolean | null>(null);

  const router = useRouter();

  // Validation functions
  const validatePhone = (phone: string) => {
    const isValid = phone.trim().length >= 7 && /^\d+$/.test(phone);
    setPhoneValid(isValid);
    return isValid;
  };

  const validatePassword = (pass: string) => {
    const isValid = pass.length >= 6;
    setPasswordValid(isValid);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!phoneNumber || !password)
      return setError("Please provide phone number and password");
    // Detect location: prefer browser geolocation (if available), otherwise fall back to IP lookup
    if (!locationCountry) {
      try {
        const res = await fetch("https://ipapi.co/json");
        if (res.ok) {
          const json = await res.json();
          setLocationCountry(json?.country || null);
        }
      } catch (err) {
        // ignore
      }

      // If still no country, try browser geolocation as a last resort
      if (!locationCountry && typeof window !== "undefined" && 'geolocation' in navigator) {
        try {
          const pos = await getCurrentPositionAsync();
          const cc = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
          if (cc) setLocationCountry(cc);
        } catch (e) {
          // ignore
        }
      }
    }
    // auto-detect country code
    if (phoneNumber) {
      const auto = parsePhoneNumberFromString(`${countryCode}${phoneNumber}`);
      if (auto && auto.countryCallingCode) {
        const detected = `+${auto.countryCallingCode}`;
        if (detected !== countryCode) {
          setCountryCode(detected);
        }
        if (auto.country) setPhoneCountryDetected(auto.country);
      }
    }
    if (!ALLOWED_COUNTRY_CODES.includes(countryCode))
      return setError("Unsupported country code");
    const parsed = parsePhoneNumberFromString(`${countryCode}${phoneNumber}`);
    if (!parsed || parsed.countryCallingCode !== countryCode.replace('+','')) {
      return setError('Phone number does not match country code');
    }

    // set mismatch flag if we can
    if (parsed && parsed.country && locationCountry) {
      setPhoneCountryDetected(parsed.country);
      setLocationMismatch(parsed.country !== locationCountry);
    } else {
      setLocationMismatch(null);
    }

    (async () => {
      setLoading(true);
      try {
        const contact = `${countryCode}${phoneNumber}`;
        const res = await signIn("credentials", {
          contact,
          password,
          countryCode: countryCode,
          redirect: false,
        });

        if (res?.error) {
          setError(res.error || "Sign in failed. Check your credentials.");
          return;
        }

        if (res?.ok) {
          router.push("/dashboard");
          return;
        }

        setError("Sign in did not complete. Please try again.");
      } catch (err: any) {
        setError(err?.message || "An error occurred during sign in.");
      } finally {
        setLoading(false);
      }
    })();
  };

  return (
    <div className="min-h-screen bg-[#1a2a4a] flex flex-col items-center justify-start pt-8 p-6">
      <div className="w-full max-w-md">
        <div className="bg-[#0f1f3a] rounded-t-lg p-4 border border-[#2a4a7a]">
          <div className="flex items-center justify-between">
            <label className="text-white text-sm font-semibold">
              Language selection
            </label>
            <div className="flex items-center gap-3">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="bg-[#1a3a5a] text-white px-3 py-1 rounded text-sm border border-[#2a4a7a] cursor-pointer"
              >
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="fr">Français</option>
              </select>
              {/* Telegram Icon */}
              <a
                href="https://t.me/andes"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-8 h-8 bg-blue-500 rounded-full hover:bg-blue-600 transition-colors"
                title="Telegram"
              >
                <svg
                  className="w-5 h-5 text-white"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M23.91 3.79L20.3 20.84c-.25 1.1-.98 1.37-1.98.85l-5.5-4.07-2.65 2.55c-.3.3-.55.56-1.12.56-.73 0-.6-.27-.84-.95L6.3 13.3 1.07 11.5c-.96-.3-1.36-.93-.14-1.43l21.26-8.2c.97-.43 1.9.24 1.57 1.91z" />
                </svg>
              </a>
              {/* YouTube Icon */}
              <a
                href="https://youtube.com/andes"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-8 h-8 bg-red-600 rounded-full hover:bg-red-700 transition-colors"
                title="YouTube"
              >
                <svg
                  className="w-5 h-5 text-white"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        <h1 className="text-white text-3xl font-bold text-center py-6 bg-[#0f1f3a] border-x border-[#2a4a7a]">
          Sign In
        </h1>

        <form
          onSubmit={handleSubmit}
          className="bg-[#1a3a5a] border border-[#2a4a7a] rounded-b-lg p-6 space-y-4"
        >
          {/* Phone Number with Country Code */}
          <div className="relative">
            <div className="flex items-center gap-2">
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className={`px-3 py-3 rounded border-2 bg-[#152a4a] text-white text-sm focus:outline-none min-w-20 ${
                  countryCode && countryCode !== ""
                    ? "border-green-500"
                    : "border-red-500"
                }`}
              >
                <option value="">Select Country</option>
                <option value="+93">🇦🇫 Afghanistan +93</option>
                <option value="+358">🇦🇽 Aland Islands +358</option>
                <option value="+355">🇦🇱 Albania +355</option>
                <option value="+213">🇩🇿 Algeria +213</option>
                <option value="+1684">🇦🇸 American Samoa +1684</option>
                <option value="+376">🇦🇩 Andorra +376</option>
                <option value="+244">🇦🇴 Angola +244</option>
                <option value="+1264">🇦🇮 Anguilla +1264</option>
                <option value="+672">🇦🇶 Antarctica +672</option>
                <option value="+1268">🇦🇬 Antigua and Barbuda +1268</option>
                <option value="+54">🇦🇷 Argentina +54</option>
                <option value="+374">🇦🇲 Armenia +374</option>
                <option value="+297">🇦🇼 Aruba +297</option>
                <option value="+61">🇦🇺 Australia +61</option>
                <option value="+43">🇦🇹 Austria +43</option>
                <option value="+994">🇦🇿 Azerbaijan +994</option>
                <option value="+1242">🇧🇸 Bahamas +1242</option>
                <option value="+973">🇧🇭 Bahrain +973</option>
                <option value="+880">🇧🇩 Bangladesh +880</option>
                <option value="+1246">🇧🇧 Barbados +1246</option>
                <option value="+375">🇧🇾 Belarus +375</option>
                <option value="+32">🇧🇪 Belgium +32</option>
                <option value="+501">🇧🇿 Belize +501</option>
                <option value="+229">🇧🇯 Benin +229</option>
                <option value="+1441">🇧🇲 Bermuda +1441</option>
                <option value="+975">🇧🇹 Bhutan +975</option>
                <option value="+591">🇧🇴 Bolivia +591</option>
                <option value="+387">🇧🇦 Bosnia and Herzegovina +387</option>
                <option value="+267">🇧🇼 Botswana +267</option>
                <option value="+55">🇧🇷 Brazil +55</option>
                <option value="+673">🇧🇳 Brunei +673</option>
                <option value="+359">🇧🇬 Bulgaria +359</option>
                <option value="+226">🇧🇫 Burkina Faso +226</option>
                <option value="+257">🇧🇮 Burundi +257</option>
                <option value="+855">🇰🇭 Cambodia +855</option>
                <option value="+237">🇨🇲 Cameroon +237</option>
                <option value="+1">🇨🇦 Canada +1</option>
                <option value="+238">🇨🇻 Cape Verde +238</option>
                <option value="+1345">🇰🇾 Cayman Islands +1345</option>
                <option value="+236">🇨🇫 Central African Republic +236</option>
                <option value="+235">🇹🇩 Chad +235</option>
                <option value="+56">🇨🇱 Chile +56</option>
                <option value="+86">🇨🇳 China +86</option>
                <option value="+61">🇨🇽 Christmas Island +61</option>
                <option value="+61">🇨🇨 Cocos Islands +61</option>
                <option value="+57">🇨🇴 Colombia +57</option>
                <option value="+269">🇰🇲 Comoros +269</option>
                <option value="+242">🇨🇬 Congo +242</option>
                <option value="+243">
                  🇨🇩 Democratic Republic of Congo +243
                </option>
                <option value="+682">🇨🇰 Cook Islands +682</option>
                <option value="+506">🇨🇷 Costa Rica +506</option>
                <option value="+385">🇭🇷 Croatia +385</option>
                <option value="+53">🇨🇺 Cuba +53</option>
                <option value="+357">🇨🇾 Cyprus +357</option>
                <option value="+420">🇨🇿 Czech Republic +420</option>
                <option value="+45">🇩🇰 Denmark +45</option>
                <option value="+253">🇩🇯 Djibouti +253</option>
                <option value="+1767">🇩🇲 Dominica +1767</option>
                <option value="+1">🇩🇴 Dominican Republic +1</option>
                <option value="+593">🇪🇨 Ecuador +593</option>
                <option value="+20">🇪🇬 Egypt +20</option>
                <option value="+503">🇸🇻 El Salvador +503</option>
                <option value="+240">🇬🇶 Equatorial Guinea +240</option>
                <option value="+291">🇪🇷 Eritrea +291</option>
                <option value="+372">🇪🇪 Estonia +372</option>
                <option value="+251">🇪🇹 Ethiopia +251</option>
                <option value="+500">🇫🇰 Falkland Islands +500</option>
                <option value="+298">🇫🇴 Faroe Islands +298</option>
                <option value="+679">🇫🇯 Fiji +679</option>
                <option value="+358">🇫🇮 Finland +358</option>
                <option value="+33">🇫🇷 France +33</option>
                <option value="+594">🇬🇫 French Guiana +594</option>
                <option value="+689">🇵🇫 French Polynesia +689</option>
                <option value="+241">🇬🇦 Gabon +241</option>
                <option value="+220">🇬🇲 Gambia +220</option>
                <option value="+995">🇬🇪 Georgia +995</option>
                <option value="+49">🇩🇪 Germany +49</option>
                <option value="+233">🇬🇭 Ghana +233</option>
                <option value="+350">🇬🇮 Gibraltar +350</option>
                <option value="+30">🇬🇷 Greece +30</option>
                <option value="+299">🇬🇱 Greenland +299</option>
                <option value="+1473">🇬🇩 Grenada +1473</option>
                <option value="+590">🇬🇵 Guadeloupe +590</option>
                <option value="+1671">🇬🇺 Guam +1671</option>
                <option value="+502">🇬🇹 Guatemala +502</option>
                <option value="+44">🇬🇬 Guernsey +44</option>
                <option value="+224">🇬🇳 Guinea +224</option>
                <option value="+245">🇬🇼 Guinea-Bissau +245</option>
                <option value="+592">🇬🇾 Guyana +592</option>
                <option value="+509">🇭🇹 Haiti +509</option>
                <option value="+504">🇭🇳 Honduras +504</option>
                <option value="+852">🇭🇰 Hong Kong +852</option>
                <option value="+36">🇭🇺 Hungary +36</option>
                <option value="+354">🇮🇸 Iceland +354</option>
                <option value="+91">🇮🇳 India +91</option>
                <option value="+62">🇮🇩 Indonesia +62</option>
                <option value="+98">🇮🇷 Iran +98</option>
                <option value="+964">🇮🇶 Iraq +964</option>
                <option value="+353">🇮🇪 Ireland +353</option>
                <option value="+44">🇮🇲 Isle of Man +44</option>
                <option value="+972">🇮🇱 Israel +972</option>
                <option value="+39">🇮🇹 Italy +39</option>
                <option value="+1876">🇯🇲 Jamaica +1876</option>
                <option value="+81">🇯🇵 Japan +81</option>
                <option value="+44">🇯🇪 Jersey +44</option>
                <option value="+962">🇯🇴 Jordan +962</option>
                <option value="+7">🇰🇿 Kazakhstan +7</option>
                <option value="+254">🇰🇪 Kenya +254</option>
                <option value="+686">🇰🇮 Kiribati +686</option>
                <option value="+850">🇰🇵 North Korea +850</option>
                <option value="+82">🇰🇷 South Korea +82</option>
                <option value="+965">🇰🇼 Kuwait +965</option>
                <option value="+996">🇰🇬 Kyrgyzstan +996</option>
                <option value="+856">🇱🇦 Laos +856</option>
                <option value="+371">🇱🇻 Latvia +371</option>
                <option value="+961">🇱🇧 Lebanon +961</option>
                <option value="+266">🇱🇸 Lesotho +266</option>
                <option value="+231">🇱🇷 Liberia +231</option>
                <option value="+218">🇱🇾 Libya +218</option>
                <option value="+423">🇱🇮 Liechtenstein +423</option>
                <option value="+370">🇱🇹 Lithuania +370</option>
                <option value="+352">🇱🇺 Luxembourg +352</option>
                <option value="+853">🇲🇴 Macao +853</option>
                <option value="+389">🇲🇰 Macedonia +389</option>
                <option value="+261">🇲🇬 Madagascar +261</option>
                <option value="+265">🇲🇼 Malawi +265</option>
                <option value="+60">🇲🇾 Malaysia +60</option>
                <option value="+960">🇲🇻 Maldives +960</option>
                <option value="+223">🇲🇱 Mali +223</option>
                <option value="+356">🇲🇹 Malta +356</option>
                <option value="+1671">🇲🇭 Marshall Islands +1671</option>
                <option value="+596">🇲🇶 Martinique +596</option>
                <option value="+222">🇲🇷 Mauritania +222</option>
                <option value="+230">🇲🇺 Mauritius +230</option>
                <option value="+262">🇾🇹 Mayotte +262</option>
                <option value="+52">🇲🇽 Mexico +52</option>
                <option value="+691">🇫🇲 Micronesia +691</option>
                <option value="+373">🇲🇩 Moldova +373</option>
                <option value="+377">🇲🇨 Monaco +377</option>
                <option value="+976">🇲🇳 Mongolia +976</option>
                <option value="+382">🇲🇪 Montenegro +382</option>
                <option value="+1664">🇲🇸 Montserrat +1664</option>
                <option value="+212">🇲🇦 Morocco +212</option>
                <option value="+258">🇲🇿 Mozambique +258</option>
                <option value="+95">🇲🇲 Myanmar +95</option>
                <option value="+264">🇳🇦 Namibia +264</option>
                <option value="+674">🇳🇷 Nauru +674</option>
                <option value="+977">🇳🇵 Nepal +977</option>
                <option value="+31">🇳🇱 Netherlands +31</option>
                <option value="+687">🇳🇨 New Caledonia +687</option>
                <option value="+64">🇳🇿 New Zealand +64</option>
                <option value="+505">🇳🇮 Nicaragua +505</option>
                <option value="+227">🇳🇪 Niger +227</option>
                <option value="+234">🇳🇬 Nigeria +234</option>
                <option value="+683">🇳🇺 Niue +683</option>
                <option value="+672">🇳🇫 Norfolk Island +672</option>
                <option value="+1670">🇲🇵 Northern Mariana Islands +1670</option>
                <option value="+47">🇳🇴 Norway +47</option>
                <option value="+968">🇴🇲 Oman +968</option>
                <option value="+92">🇵🇰 Pakistan +92</option>
                <option value="+680">🇵🇼 Palau +680</option>
                <option value="+507">🇵🇦 Panama +507</option>
                <option value="+675">🇵🇬 Papua New Guinea +675</option>
                <option value="+595">🇵🇾 Paraguay +595</option>
                <option value="+51">🇵🇪 Peru +51</option>
                <option value="+63">🇵🇭 Philippines +63</option>
                <option value="+64">🇵🇳 Pitcairn +64</option>
                <option value="+48">🇵🇱 Poland +48</option>
                <option value="+351">🇵🇹 Portugal +351</option>
                <option value="+1939">🇵🇷 Puerto Rico +1939</option>
                <option value="+974">🇶🇦 Qatar +974</option>
                <option value="+40">🇷🇴 Romania +40</option>
                <option value="+7">🇷🇺 Russia +7</option>
                <option value="+250">🇷🇼 Rwanda +250</option>
                <option value="+590">🇧🇱 Saint Barthelemy +590</option>
                <option value="+1869">🇰🇳 Saint Kitts and Nevis +1869</option>
                <option value="+1758">🇱🇨 Saint Lucia +1758</option>
                <option value="+590">🇲🇫 Saint Martin +590</option>
                <option value="+508">🇵🇲 Saint Pierre and Miquelon +508</option>
                <option value="+1784">
                  🇻🇨 Saint Vincent and the Grenadines +1784
                </option>
                <option value="+685">🇼🇸 Samoa +685</option>
                <option value="+378">🇸🇲 San Marino +378</option>
                <option value="+239">🇸🇹 Sao Tome and Principe +239</option>
                <option value="+966">🇸🇦 Saudi Arabia +966</option>
                <option value="+221">🇸🇳 Senegal +221</option>
                <option value="+381">🇷🇸 Serbia +381</option>
                <option value="+248">🇸🇨 Seychelles +248</option>
                <option value="+232">🇸🇱 Sierra Leone +232</option>
                <option value="+65">🇸🇬 Singapore +65</option>
                <option value="+1721">🇸🇽 Sint Maarten +1721</option>
                <option value="+421">🇸🇰 Slovakia +421</option>
                <option value="+386">🇸🇮 Slovenia +386</option>
                <option value="+677">🇸🇧 Solomon Islands +677</option>
                <option value="+252">🇸🇴 Somalia +252</option>
                <option value="+27">🇿🇦 South Africa +27</option>
                <option value="+211">🇸🇸 South Sudan +211</option>
                <option value="+34">🇪🇸 Spain +34</option>
                <option value="+94">🇱🇰 Sri Lanka +94</option>
                <option value="+249">🇸🇩 Sudan +249</option>
                <option value="+597">🇸🇷 Suriname +597</option>
                <option value="+47">🇸🇯 Svalbard and Jan Mayen +47</option>
                <option value="+268">🇸🇿 Eswatini +268</option>
                <option value="+46">🇸🇪 Sweden +46</option>
                <option value="+41">🇨🇭 Switzerland +41</option>
                <option value="+963">🇸🇾 Syria +963</option>
                <option value="+886">🇹🇼 Taiwan +886</option>
                <option value="+992">🇹🇯 Tajikistan +992</option>
                <option value="+255">🇹🇿 Tanzania +255</option>
                <option value="+66">🇹🇭 Thailand +66</option>
                <option value="+670">🇹🇱 East Timor +670</option>
                <option value="+228">🇹🇬 Togo +228</option>
                <option value="+690">🇹🇰 Tokelau +690</option>
                <option value="+676">🇹🇴 Tonga +676</option>
                <option value="+1868">🇹🇹 Trinidad and Tobago +1868</option>
                <option value="+216">🇹🇳 Tunisia +216</option>
                <option value="+90">🇹🇷 Turkey +90</option>
                <option value="+993">🇹🇲 Turkmenistan +993</option>
                <option value="+1649">🇹🇨 Turks and Caicos Islands +1649</option>
                <option value="+688">🇹🇻 Tuvalu +688</option>
                <option value="+256">🇺🇬 Uganda +256</option>
                <option value="+380">🇺🇦 Ukraine +380</option>
                <option value="+971">🇦🇪 United Arab Emirates +971</option>
                <option value="+44">🇬🇧 United Kingdom +44</option>
                <option value="+1">🇺🇸 United States +1</option>
                <option value="+598">🇺🇾 Uruguay +598</option>
                <option value="+998">🇺🇿 Uzbekistan +998</option>
                <option value="+678">🇻🇺 Vanuatu +678</option>
                <option value="+39">🇻🇦 Vatican City +39</option>
                <option value="+58">🇻🇪 Venezuela +58</option>
                <option value="+84">🇻🇳 Vietnam +84</option>
                <option value="+1284">🇻🇬 British Virgin Islands +1284</option>
                <option value="+1340">🇻🇮 US Virgin Islands +1340</option>
                <option value="+681">🇼🇫 Wallis and Futuna +681</option>
                <option value="+212">🇪🇭 Western Sahara +212</option>
                <option value="+967">🇾🇪 Yemen +967</option>
                <option value="+260">🇿🇲 Zambia +260</option>
                <option value="+263">🇿🇼 Zimbabwe +263</option>
              </select>
              <input
                value={phoneNumber}
                onChange={(e) => {
                  setPhoneNumber(e.target.value);
                  validatePhone(e.target.value);
                }}
                placeholder="Please enter mobile phone number"
                type="tel"
                className={`flex-1 px-4 py-3 rounded border-2 bg-[#152a4a] text-white placeholder-red-400 text-sm focus:outline-none ${
                  phoneNumber && phoneValid === true
                    ? "border-green-500"
                    : "border-red-500"
                }`}
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="relative">
            <input
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                validatePassword(e.target.value);
              }}
              placeholder="Please enter password"
              type="password"
              className={`w-full px-4 py-3 rounded border-2 bg-[#152a4a] text-white placeholder-gray-500 text-sm focus:outline-none ${
                password && passwordValid === true
                  ? "border-green-500"
                  : password
                  ? "border-red-500"
                  : "border-gray-500"
              }`}
            />
            {passwordValid === false && (
              <p className="text-red-400 text-xs mt-1">
                Password must be at least 6 characters.
              </p>
            )}
          </div>

          {error && (
            <div className="text-red-400 text-sm text-center">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-[#1a3a5a] font-bold py-3 rounded hover:bg-gray-200 transition-colors duration-200 mt-6"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>

          <button
            type="button"
            onClick={() => (window.location.href = "/register")}
            className="w-full bg-[#2a5a9a] text-white font-semibold py-2 rounded hover:bg-[#3a6aaa] transition-colors duration-200"
          >
            Register
          </button>

          <div className="mt-4 text-center">
            <a
              href="/forgot-password"
              className="text-blue-400 hover:text-blue-300 text-sm font-semibold"
            >
              Forgot password?
            </a>
          </div>
        </form>
      </div>

      <SupportChat />
    </div>
  );
}
