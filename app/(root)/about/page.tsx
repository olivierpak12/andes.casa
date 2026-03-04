import Image from 'next/image';

export default function AboutPage() {
  return (
    <div className="font-montserrat text-gray-800 overflow-x-hidden bg-gray-50">
      

      {/* Gallery Section */}
      <section className="pt-32 pb-20 px-[5%] bg-white">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-4">Gallery</h1>
          <p className="text-xl md:text-2xl text-cyan-500 mb-16">Highlights from Our Global Network</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { src: '/garelly.jfif', alt: 'Gallery 1' },
              { src: '/garelly1.jfif', alt: 'Gallery 2' },
              { src: '/Customizedsolutions.png', alt: 'Andes Shared Scooter Company', caption: 'Andes Shared Scooter Company Limited (Andes)' },
            ].map((item, index) => (
              <div key={index} className="relative group overflow-hidden rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500">
                <Image
                  src={item.src}
                  alt={item.alt}
                  width={600}
                  height={320}
                  className="w-full h-80 object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-end p-6">
                  {item.caption && <p className="text-white font-semibold text-lg">{item.caption}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* EB-1 Electric Bike Section */}
      <section className="py-20 px-[5%] bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Images */}
            <div className="space-y-6">
              <div className="relative overflow-hidden rounded-2xl shadow-xl">
                <Image
                  src="/SmartScooterTechnology.png"
                  alt="ANDES Electric Bike - Close up"
                  width={800}
                  height={192}
                  className="w-full h-48 object-cover"
                />
              </div>
              <div className="relative overflow-hidden rounded-2xl shadow-xl">
                <Image
                  src="/Customizedsolutions.png"
                  alt="ANDES EB-1 Electric Bike"
                  width={800}
                  height={384}
                  className="w-full h-96 object-cover"
                />
              </div>
            </div>

            {/* Content */}
            <div>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">Exploring the EB-1 Electric Bike</h2>
              <p className="text-lg text-gray-600 leading-relaxed">
                The EB-1 is our latest generation electric pedal-assist bike, specifically designed for rental bikes and rider safety. It features sturdy 26-inch pneumatic wheels and dual drum brakes for improved durability and a better user experience. Ideal for long-distance travel, it's the first-mile and last-mile solution for commuting, but also very suitable for leisure activities.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Join Our Journey Section */}
      <section className="relative py-32 px-[5%] bg-gradient-to-br from-gray-200 via-gray-300 to-gray-400 overflow-hidden">
        {/* Curved Bottom */}
        <div
          className="absolute bottom-0 left-0 right-0 h-32 bg-white"
          style={{ clipPath: 'ellipse(100% 100% at 50% 100%)' }}
        />

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <h2 className="text-5xl md:text-6xl font-bold text-white mb-6">JOIN OUR JOURNEY</h2>
          <p className="text-2xl md:text-3xl text-white mb-12">Collaborate and Innovate with ANDES</p>
          <a
            href="#opportunities"
            className="inline-block px-10 py-4 bg-cyan-500 text-white font-semibold text-lg rounded-md 
                     hover:bg-cyan-600 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
          >
            EXPLORE OPPORTUNITIES
          </a>
        </div>
      </section>

      {/* Our Influence Section */}
      <section className="py-20 px-[5%] bg-white">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-5xl md:text-6xl font-bold text-gray-900 mb-4">Our influence</h2>
          <p className="text-xl md:text-2xl text-cyan-500 mb-16">Driving Success Through Integrity</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              {
                img: '/SmartScooterTechnology.png',
                alt: 'People riding scooters in nature',
                title: 'Sustainable development is our driving force',
                desc: 'To fulfill the environmental mission of sharing micromobility, we strive to provide alternatives to unnecessary car travel.',
              },
              {
                img: '/GlobalNetwork.png',
                alt: 'Community team with scooters',
                title: 'Developing our community',
                desc: 'Through partnerships and localization, we measure our success based on our ability to provide accessible services and have a positive social impact in the communities where we operate.',
              },
              {
                img: '/Safe&SecureRides.jpg',
                alt: 'Safety event with team',
                title: 'Safety is our DNA',
                desc: 'The safety of our users and the entire community is our priority.',
              },
            ].map((card, index) => (
              <div
                key={index}
                className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2"
              >
                <div className="relative h-64 overflow-hidden">
                  <Image
                    src={card.img}
                    alt={card.alt}
                    width={600}
                    height={256}
                    className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
                  />
                </div>
                <div className="p-8">
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">{card.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{card.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 px-[5%]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="font-playfair text-xl font-bold">ANDES</span>
            </div>
            <p className="text-gray-400 text-sm">Empowering a Global Sharing Economy for Tomorrow's Leaders</p>
          </div>

          <div>
            <h4 className="font-semibold text-lg mb-4">Quick Links</h4>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li>
                <a href="#home" className="hover:text-cyan-500 transition-colors">
                  Home
                </a>
              </li>
              <li>
                <a href="#about" className="hover:text-cyan-500 transition-colors">
                  About Us
                </a>
              </li>
              <li>
                <a href="#services" className="hover:text-cyan-500 transition-colors">
                  Services
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-lg mb-4">Support</h4>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li>
                <a href="#faq" className="hover:text-cyan-500 transition-colors">
                  FAQ
                </a>
              </li>
              <li>
                <a href="#contact" className="hover:text-cyan-500 transition-colors">
                  Contact
                </a>
              </li>
              <li>
                <a href="#privacy" className="hover:text-cyan-500 transition-colors">
                  Privacy Policy
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-lg mb-4">Connect</h4>
            <p className="text-gray-400 text-sm mb-4">Follow us on social media</p>
            <div className="flex gap-4">
              {['f', 't', 'in'].map((icon, index) => (
                <a
                  key={index}
                  href="#"
                  className="w-10 h-10 bg-cyan-500 rounded-full flex items-center justify-center hover:bg-cyan-600 transition-colors"
                >
                  <span className="text-white font-bold">{icon}</span>
                </a>
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