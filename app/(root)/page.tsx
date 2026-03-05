import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function Home() {
  return (
    <div className="font-montserrat text-gray-800 overflow-x-hidden">
      {/* Navigation */}
      <nav className="absolute top-6 left-0 right-0 z-30">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <Link href="/" className="text-white font-bold text-xl tracking-wider">
            ANDES
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-white/90 hover:text-white">
              Dashboard
            </Link>
            <Link
              href="/sign-in"
              className="px-4 py-2 bg-white text-cyan-600 rounded-full font-semibold shadow"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="px-4 py-2 border border-white text-white rounded-full hover:bg-white/10"
            >
              Create Account
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section
        id="home"
        className="relative h-screen flex items-center justify-center text-center overflow-hidden bg-gradient-to-br from-purple-600 to-purple-900"
      >
        {/* Background Pattern */}
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='100' height='100' fill='none'/%3E%3Ccircle cx='50' cy='50' r='1' fill='white' opacity='0.3'/%3E%3C/svg%3E")`,
            backgroundSize: '50px 50px',
          }}
        />

        {/* Background Image */}
        <div className="absolute inset-0 w-full h-full pointer-events-none">
          <Image
            src="/SmartScooterTechnology.png"
            alt="Person riding electric scooter"
            fill
            sizes="100vw"
            className="object-cover opacity-40"
          />
        </div>

        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/70 to-blue-900/80 pointer-events-none" />

        {/* Content */}
        <div className="relative z-10 max-w-4xl px-8">
          <p className="text-lg text-white mb-4 font-light tracking-[3px] uppercase">
            Empowering a Global Sharing Economy for Tomorrow's Leaders
          </p>
          <h1 className="font-playfair text-6xl md:text-7xl text-white mb-8 font-bold leading-tight">
            Welcome to ANDES
          </h1>
          <a
            href="#solutions"
            className="inline-block px-12 py-4 bg-white text-cyan-500 font-semibold text-lg rounded-full 
                     transition-all duration-300 shadow-2xl hover:shadow-3xl hover:-translate-y-1 hover:bg-red-400 hover:text-white"
          >
            Discover More
          </a>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-8 h-12 border-2 border-white/50 rounded-full">
          <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white/80 rounded-full animate-bounce" />
        </div>
      </section>

      {/* Customized Solutions Section */}
      <section id="solutions" className="py-32 px-[5%] bg-gradient-to-b from-gray-50 to-white relative">
        {/* Top Gradient */}
        <div className="absolute top-0 left-0 right-0 h-36 bg-gradient-to-b from-blue-900/5 to-transparent" />

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Image */}
          <div className="relative rounded-3xl overflow-hidden shadow-2xl group">
            <Image
              src="/Customizedsolutions.png"
              alt="Group of people with electric scooters"
              width={800}
              height={600}
              className="w-full h-auto block transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/30 to-blue-900/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          </div>

          {/* Content */}
          <div>
            <h2 className="font-playfair text-5xl md:text-6xl text-blue-900 mb-8 leading-tight relative inline-block
                          after:content-[''] after:absolute after:bottom-[-10px] after:left-0 after:w-20 after:h-1 after:bg-cyan-500 after:rounded-full">
              Customized solutions
            </h2>
            <p className="text-lg leading-relaxed text-gray-600 mb-8">
              The city is our most important customer. We look forward to establishing a close relationship with the
              municipal government and working with them to make short trips as safe and efficient as possible.
            </p>
            <p className="text-base leading-relaxed text-gray-500 mb-10 pl-6 border-l-4 border-cyan-500">
              We strive to be the most flexible partner possible, which is why we constantly improve our service based
              on feedback from cities and riders.
            </p>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
              {[
                { title: 'Smart Scooter Technology', img: '/SmartScooterTechnology.png' },
                { title: 'Global Network', img: '/GlobalNetwork.png' },
                { title: 'Safe & Secure Rides', img: '/Safe&SecureRides.jpg' },
                { title: 'Easy Mobile Access', img: '/SmartScooterTechnology.png' },
              ].map((feature, index) => (
                <div
                  key={index}
                  className="flex items-center gap-4 p-6 bg-white rounded-2xl shadow-lg transition-all duration-300 hover:-translate-y-2 hover:shadow-xl"
                >
                  <div className="w-12 h-12 flex-shrink-0 rounded-xl overflow-hidden bg-gradient-to-br from-cyan-500 to-blue-600">
                    <Image
                      src={feature.img}
                      alt={feature.title}
                      width={48}
                      height={48}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="text-sm font-medium text-gray-800">{feature.title}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="py-24 px-[5%] bg-gradient-to-r from-blue-900 to-purple-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-playfair text-5xl md:text-6xl text-white mb-8 leading-tight">
            Ready to Join ANDES?
          </h2>
          <p className="text-xl text-gray-100 mb-12 max-w-2xl mx-auto">
            Start your journey with us today and become part of the global sharing economy revolution.
          </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <Link
              href="/sign-in"
              className="px-10 py-4 bg-white text-blue-900 font-semibold text-lg rounded-full 
                       transition-all duration-300 shadow-xl hover:shadow-2xl hover:-translate-y-1 hover:bg-cyan-400"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="px-10 py-4 bg-transparent text-white font-semibold text-lg rounded-full border-2 border-white
                       transition-all duration-300 hover:bg-white hover:text-blue-900 hover:-translate-y-1"
            >
              Create Account
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}